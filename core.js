//
// Nutural Language Understanding
//   matsuda@monogocoro.co.jp   2018.12 for JRW FAQ強化学習システム
//      (a) FAQモード input: line=文字列, output: JCODE
//      (b) CHATモード
//            input: line={chat_in: 文字列}
//            output: {chat_out: {chat_reply: JCODE, chat_edit: DB編集query}}
//                JCODE : 
//                DB編集query: {}あるいは{"editSDB": ... ]のJSONコード


//   matsuda@monogocoro.co.jp   2018.11
//
// 全体の構成
// 日本語音声 ==[Google 音声toテキスト] ==> 日本語テキスト
// 日本語テキスト ==[翻訳みらい] ==> 英文(mirai)
// 英文(mirai) ==[enju: HPSG] ==> 構文解析結果(XML)
//      HPSG: Head-driven phrase structure grammar 主辞駆動句構造文法
// 構文解析結果(JSON) ==[generateCode()] ==> ターミナル式 [ecode]
// 意味トークン抽出: ecode ==[generateScode()] ==> 意味トークン式 [scode]
// scode == [generateJcode()]  == query生成 [jcode]

'use strict';
var _ = require('lodash');
const Realm = require('realm');

var debugC = false;  // enju木出力
var eprint = false; // ecode出力
var print = false;
var debug = false;

// --------------------
// システムインタプリタ
// -------------------

var noEmpty = true;

var chat; // for chat mode flag

// make it availableでavailableを未処理で残して場合。
// 具体的にはunprocessedの中で設定し、pickVerbの中で使用する。
var complement = null; 

var session_no;

var input = {}; //protocol stack for line, ecode, etc:

//
// 文の種類
//
// 平叙文 affirmative [AFF]
// 一般疑問文 question [QST]
// wh疑問文 wh question [whQST] who, which, why, where, what, how
// 選択疑問文 alternative question [altQST]
// 付加疑問文 tag question [tagQuetion]
// 命令文-肯定形 affirmative imperative [affIMP]
// 命令文-否定形 negative imperative [negIMP]
//        letIMP
//        letsIMP
// 感嘆文 exclamatory [EXCL]
//  

input['type'] = 'AFF';


//テスト用例文 
//  明日の夕方6時30分にスタバで会いましょう。
//  Let's meet at STARBUCKS time 0630 tomorrow evening.
//  私は死んでない。 
//  I'm not dead.

function printInput(obj){
    console.log("line:",obj.line[0]);
    console.log("j2e_replace:",obj.j2e_replace[0]);
    console.log("mirai:",obj.mirai[0]);
    console.log("mirai_extend:",obj.mirai_extend[0]);
    console.log("enju:",obj.enju[0]);
    console.log("ecode:");
    for (var i = 0; i< obj.ecode[0].length; i++){
	console.log(JSON.stringify(obj.ecode[0][i]));
    }
}

function interpreter(language, mode_flag, line0){

    // all reset for global variables in this code
    nodemarks = [];
    tokens = [];
    tokenIdList = [];
    tokenList = [];
    complement = null;

    input["line"] = [];
    input["j2e_replace"] = [];
    input["mirai"] = [];
    input["mirai_extend"] = [];
    input["enju"] = [];
    input["ecode"] = [];

    // --->

    function ucfirst(s){
	return(s.charAt(0).toUpperCase() + s.slice(1));
    }

    function capitalize(s){
	var S = s.split(' ');
	var sent = ucfirst(S[0]);
	for(var i = 1; i < S.length; i++){
	    sent = sent + ' '+ ucfirst(S[i]);
	}
	return sent;
    }

    // 引数説明
    //    language: 'japanese' | 'english'
    //    mode_flag: 'none'（通常) | 'select'（選択） | 'command'（音声コマンド）
    //var line = voice_correct(line0); // 音声入力からテキスト変換の誤りを訂正
    var line = line0;
    chat = false;
    if (line[0] === '{'){
	chat = true;
	//session_no = JSON.parse(line).session_no;
        //line = JSON.parse(line).chat_in;
	line = eval(line);
    }
    console.log("line:", line);

    if (mode_flag == "keyboard" && language == "ja"){ //ひらがな->漢字
	//console.log("かな変換:", line);
	line = e2j_kanareplace(line);
    } else if (language == "en"){ //英語：各単語の先頭を大文字化。
	line = capitalize(line);
    } else {
	//console.log("通常:", line);
	line = line;
    }

    input["line"].push(line);

    if (!noEmpty) { //ターミナルから入力時を想定 CRの対応
        noEmpty = true;
        return;
    }

    // 日本語 -> mirai -> enju.xml -> enju.js
    var enjujs = get_enju_json(line, language);

    // enjujs を {tokens, nodemarks}に分解
    findTokenList(enjujs);

    // tokensの中身をすべてオブジェクトとして登録
    createTokenObjects(tokens);

    // nodemarksを利用し、token内のarg1, arg2, arg3の値を再整備
    // （他のトークンオブジェクトへのポインタ)
    resolveArgLinks();

    // code生成 : ecode
    generateCode(line); // lineを引数にとっているが現在は未使用。

    // gremlin code 生成
    return(generateGcode());
}

//
// Neo4j グラフデータベース
//
function neo4jAPI (token){
    var params_text = token.replace(/\s+/g, "");
    var neo4jURL="http://ec2-54-65-31-201.ap-northeast-1.compute.amazonaws.com:3000/things/";
    var url = neo4jURL + encodeURIComponent(params_text);
    var request = require('sync-request');
    var res = request('GET', url);
    return JSON.parse(res.getBody('utf8'));
}
//console.log(neo4jAPI("本屋"));
//console.log(neo4jAPI("お手洗い"));

function existDBQ (token){
    return (neo4jAPI(token).data !== null);
}
//console.log(existDBQ("本屋"));
//console.log(existDBQ("お手洗い"));


//
// データベースを利用した変換関数
// 
function replace_with_db(s, dbobjs, key1, key2, prefix){
    // prefix: "" | "$"
    var modified = s;
    var j = 0;
    //console.log("dbobjs:", dbobjs);
    var i = 0;
    while (i < dbobjs.length) {
	//console.log("key1: ",key1, " value:", dbobjs[i][key1], " key2:", key2, " value: ",dbobjs[i][key2]);
        j = modified.indexOf(dbobjs[i][key1]);
        if (j == -1) {
	    i++;
	    continue
	};
        modified = modified.replace(dbobjs[i][key1], prefix+dbobjs[i][key2]);
        break;
    }
    return modified;
}
/*
function replace_with_db(s, dbobjs, key1, key2, prefix){
    // prefix: "" | "$"
    var modified = s;
    var j = 0;
    //console.log("dbobjs:", dbobjs);
    while (j != -1) {//一文に複数の置換が起きる場合を考慮
        for (var i = 0; i < dbobjs.length; i++) {
	    console.log("key1: ",key1, " value:", dbobjs[i][key1], " key2:", key2, " value: ",dbobjs[i][key2]);
            j = modified.indexOf(dbobjs[i][key1]);
            if (j == -1) continue;
            modified = modified.replace(dbobjs[i][key1], prefix+dbobjs[i][key2]);
            break;
        }
    };
    return modified;
}
*/
//
// voice_correnct: interpreter補助関数
//
// 音声toテキストでの誤変換に対処
// 例。当時 => toji => 東寺
// use. ./db/voice_correction_dic.db 辞書
// 
const vcdb = new Realm({path: __dirname+'/db/voice_correction_dic.db'});
var vcdbdic = vcdb.objects('voice_correction_dicdb');
function voice_correct(s){
    return replace_with_db(s, vcdbdic, "henkan", "teisei", "");
}

//
// mirai_correnct: interpreter補助関数
//
// 例。日本語固有名詞$higashihongaji
// みらいは、$highonganjiと誤変換。機械学習の弊害
// use. ./db/mirai_correction_dic.db 辞書
// 
const mcdb = new Realm({path: __dirname+'/db/mirai_correction_dic.db'});
var mcdbdic = mcdb.objects('mirai_correction_dicdb');
function mirai_correct(s){
    return replace_with_db(s, mcdbdic, "wrong", "teisei", "");
}

//
// j2e_replace: enju処理前に日本語を英語になおす
//
const j2edb = new Realm({path: __dirname+'/db/j2e_dic.db'});
var j2edbdic = j2edb.objects('j2e_dicdb');
function j2e_replace(s){
    //return replace_with_db(s, j2edbdic, "jword", "eword", "$");
    return replace_with_db(s, j2edbdic, "jword", "eword", "");
}


//
// e2j_kanareplace: キーボード入力時、ひらがなを日本語に変換
//
//const e2jdb = new Realm({path: __dirname+'/db/e2j_dic.db'});
//var e2jdbdic = e2jdb.objects('e2j_dicdb');
function e2j_kanareplace(s){
    return replace_with_db(s, e2jdbdic, "hiragana", "jword", "");
}

//
// e2j_replace: jcode生成後、英語を日本語になおす
//
const e2jdb = new Realm({path: __dirname+'/db/e2j_dic.db'});
var e2jdbdic = e2jdb.objects('e2j_dicdb');
function e2j_replace(s){
    //console.log("e2j_replace:", s);
    var r =e2jdbdic.filtered('eword = '+'"'+s+'"');
    //console.log("r:", r, " eword:", r[0].eword, " jword:", r[0].jword);
    if (JSON.stringify(r) == "{}") return s;
    else return r[0].jword;
}

//console.log(e2j_replace("where is taxi_stand?"));

//
// 英単語から日本語を得る
//
function jword(eword){
    var r = e2jdbdic.filtered('eword = '+ '"' + eword + '"');
    if (JSON.stringify(r) == "{}") return "不明";
    else return(r[0].jword);
}
//console.log(jword("bookstore"));
//console.log(jword("restroom"));

//
// 複文を単文に変換
//
function double2single(s){
    //I left something on the train. Where should I go?
    //I left something on the train and Where should I go?
    var modified = s;
    // 暫定処理。ちゃんと汎用化！
    modified = modified.replace(". Where", " and Where ");
    modified = modified.replace(". Is", " and Is ");
    modified = modified.replace(". What", " and What ");
    return modified;
}

//console.log(double2single("I left something on the train. Where should I go?"));

// 
// --------------------------------------
// 日本語 -> mirai -> enju.xml -> enju.js
// get_enju_json()
// --------------------------------------

var mirai;
var parseString = require('xml2js').parseString;
function get_enju_json(text0, language) {

    if (language == "en"){
	mirai = text0;
    }
    else { // japanse
	/* 日本語一部 $化 */
	var text = j2e_replace(text0);

	input["j2e_replace"].push(text);
	
	/* 日本語->English */ mirai = get_ja2en(text);
	mirai = mirai_correct(mirai); // 機械学習による誤変換を訂正
	mirai = preprocessing_time(mirai);
	mirai = double2single(mirai); //複文を単文に
    }
    input["mirai_extend"].push(tokenSplit(mirai));
    input["mirai"].push(mirai);

    //重要　
    /*
    たとえば動詞"was found"はenjuの原型では[be, find]となる。
    文の正確な意味をつかみたい時は、'be-found'もしくはもっと踏み込んで'was-found'とすべき。
    一方、辞書管理は煩雑になる。でも、本来はやるべき。
    */

    //複文
    //車内で忘れ物をしたがどこに行けばいいか。
    //I left something on the train. Where should I go?
    //=>I left something on the train and Where should I go?
   
    /* English-> enju.xml */ var xml = get_enju_xml(mirai);
    var json = {};
    /* enju.xml->enu.json */ parseString(xml, function (err, result) {
        json = JSON.stringify(result);
    });
    //console.log(JSON.stringify(JSON.parse(json), null, ' '));
    //input["enju"].push(json);
    return json;
}

function tokenSplit(s0) {

    //miraiの出力(英文）をecode各行に対応するように各単語単位に分割する。
    //console.log(not_tokenSplit("How far is it from Tokyo to Kyoto?"));
    //console.log(not_tokenSplit("Isn't the Haruka that leaves at 6:22 the platform 30?"));
    var s = not_tokenSplit(s0);
    s = s.replace(':', ' &cln ');
    s = s.replace("'d", ' would');
    s = s.replace("'s", " &s");
    s = s.replace("'m", " am");
    s = s.replace(",", " ,");
    s = s.replace(/\.$|\?$/, '');
    return s;
    //var a = s.split(' ');
    //return a.filter(function (e) { return e !== ""; });
}
//console.log("tokenSplit:", tokenSplit("I'm not dead."));

function not_tokenSplit(s0){
    
    // isn't => is not
    // aren't, wasn't, weren't
    var s = s0;
    s = s.replace('isn\'t', 'is not');
    s = s.replace('wasn\'t', 'was not');
    s = s.replace('aren\'t', 'are not');
    s = s.replace('weren\'t', 'were not');
    s = s.replace('Isn\'t', 'Is not');
    s = s.replace('Wasn\'t', 'Was not');
    s = s.replace('Aren\'t', 'Are not');
    s = s.replace('Weren\'t', 'Were not');
    return s;
}
//console.log(tokenSplit("How far is it from Tokyo to Kyoto?"));
//console.log(tokenSplit("Isn't the Haruka that leaves at 6:22 the platform 30?"));

// get_enju_json 補助関数: get_ja2en
function get_ja2en(text) {
    
    var params_text = text.replace(/\s+/g, "");
    var url = 'https://preprocessor.monogocoro.ai/ja2en/' + encodeURIComponent(params_text);
    // for goolish: add "?google=True" in the last of the sentence
    var request = require('sync-request');
    var res = request('GET', url);
    return res.getBody('utf8');
}


// get_enju_json 補助関数: get_enju_xml
function get_enju_xml(text0) {
    
    //var text = cutdollar(text0);
    var text = text0;
    var url = 'https://preprocessor.monogocoro.ai/en2enju_xml/' + encodeURIComponent(text);
    var request = require('sync-request');
    var res = request('GET', url);
    return res.getBody('utf8');
}

function cutdollar(str){
    
    // MIRAIで不用意に変換されないよう、特定の日本語固有名詞の英語名の冒頭に$マークをつける。
    // MIRAI翻訳後の英文をenjuにかける前に$マークを削除する。
    // 例. 
    // "I went to $KINKAUJI." => I went to KINKAKUJI.
    // "I spent $10.00 yesterday" => I spent $10.00 yesterday.
    var s = "";
    var pat = /\d/; //数字
    for (var i = 0; i < str.length; i = i + 1){
	var c = str[i];
	if (c == '$' && !pat.test(str[i+1])) continue;
	s = s + c;
    }
    return s;
}

function preprocessing_time(s){

    // miraiにかけたあとenjuに投入する前に処理。
    //"Isn't the Haruka that leaves at 6:22 the platform 30?"
    //=> "Isn't the Haruka that leaves at time 0622 the platform 30?"
    // 0622 is analyzed as a -YEAR-

    // 2018.11時点、 6:22が"6: 22"に分解される。
    var split = s.replace(': ', ':');  // 6: 22 を6:22に戻す。
    // 本来の処理
    split = split.split(' ');
    var stack = [];
    for (var i = 0; i < split.length; i++){
	var r = split[i].split(':');
	if (r.length == 2){
	    var r1 = r[0]; var r2 = r[1];
	    if (r1.length == 1) r1 = "0"+r1;
	    if (r2.length == 1) r2 = "0"+r2;
	    r = ["time", r1+r2];
	}
	stack = _.union(stack, r);
    }

    var ss = "";
    for (var i = 0; i < stack.length-1; i++){
	ss = ss + stack[i] + " ";
    }
    ss = ss + stack[i];
    return ss;
}

// --------------------------------------
// findTokenList(enjujs)
//    enjujs を {tokens, nodemarks}に分解
// --------------------------------------  
    
function findTokenList(parsed0) {
    
    var parsed = parsed0.replace(/\$/g, "nodemark");
    var sentence = JSON.parse(parsed).sentence;
    var parseStatus = sentence["nodemark"]["parse_status"];
    if (!(parseStatus == "success" || parseStatus == "fragmental parse")) return;
    var sentenceType = sentence["_"];

    // getToken関数実行時、tokenリストおよびnodemarksリストを作成。
    JSON.stringify(JSON.parse(parsed), getToken);
}

var nodemarks = [];
var tokens = [];
function getToken(key, value) {
    
    if (key == "nodemark") {
        nodemarks.push(value);
    }
    if (key == "tok") {
        tokens.push(value);
    }
    return value;
}

// -----------------------------------------
// tokensの中身をすべてオブジェクトとして登録
//    createTokenObjects(tokens);
// -----------------------------------------

var tokenIdList = [];
var tokenList = [];
function createTokenObjects(tokens0) {
    
    for (var i in tokens0) {
        var tkn = new Object();
        tkn.content = tokens[i][0].nodemark;
        tkn.arg1 = null;
        tkn.arg2 = null;
        tkn.arg3 = null;
        tokenIdList.push(tkn.content.id);
        tokenList.push(tkn);
    };
    tokens = [];
}

// -------------------------------------------------------
// nodemarksを利用し、token内のarg1, arg2, arg3の値を再整備
// 他のトークンオブジェクトへのポインタを解決
//    resolveArgLinks();
// -------------------------------------------------------

function resolveArgLinks() {

    if (debugC) console.log(tokenList);

    // nodemarksを利用し、token内のarg1, arg2, arg3の値
    // （他のトークンオブジェクトへのポインタ)
    for (var i in tokenList) {
        var tkn = tokenList[i];
        if (tkn.content.arg1 != undefined) {
            tkn.arg1 = tokenSearch(tkn.content.arg1);
        }
        if (tkn.content.arg2 != undefined) {
            tkn.arg2 = tokenSearch(tkn.content.arg2);
        }
        if (tkn.content.arg3 != undefined) {
            tkn.arg3 = tokenSearch(tkn.content.arg3);
        }
    }
    //sentence_cat = nodemarks[1].cat;
    //sentence_xcat = nodemarks[1].xcat;
    //if (debugC) console.log("nodemarks = ", nodemarks);
    //console.log("nodemarks = ", nodemarks);
    nodemarks = [];

}

//
// resolveArgLinks() 補助関数
// 

function tokenSearch(id) {
    
    var cid = 0; // nodeリストの中からidに相当する場所を探す。
    for (var i in nodemarks) {
        if (nodemarks[i]["id"] != id) continue;
        cid = nodemarks[i]["sem_head"];
        break;
    }
    // console.log("i=",i, " cid=",cid);

    // 見つかった箇所からtで始まるラベルを持つ（トークン）を探す
    for (var j = i; j < nodemarks.length; j++) {
        if (nodemarks[j]["id"] != cid) continue;
        if (!(isToken(cid))) {
            cid = nodemarks[j]["sem_head"];
            continue;
        }
        // 見つかった。
        //console.log(tokenList[tokenIndex(cid)]);
        return (tokenList[tokenIndex(cid)]);
    };
    //console.log("未登録のトークンが存在；", cid);
}

function isToken(id) {
    return id.startsWith('t')
}

function tokenIndex(id) {
    var index = -1;
    for (var i = 0; i < tokenIdList.length; i++) {
        if (tokenIdList[i] != id) continue;
        index = i;
        break;
    }
    return index;
}

// --------------------
// code生成 : ecode
//   generateCode(line)
// --------------------

var ecode;
function generateCode(line) {

    if (print) console.log("--ecode--");
    if (JSON.stringify(tokenList) == "[]") {
        console.log(line, "が翻訳出来ませんでした。");
        return;
    }
    // -- code: ecode一步手前。ecode生成のための情報収集
    var stack = [];
    var code = {};
    //code["sentence_cat"] = sentence_cat;
    //code["sentence_xcat"] = sentence_xcat;
    //stack.push(code); code = {};

    if (tokenList.length >= 3 && tokenList[0].cat == "N" && tokenList[1].cat == "N" && tokenList[2].cat == "N") {
        console.log(line, "が翻訳出来ませんでした。");
        return
    }

    for (var i in tokenList) {
        var cat = tokenList[i].content.cat;
        /*
        if (tokenList[i].content.cat == "V" && tokenList[i].content.type == "noun_mod")
            cat = tokenList[i].content.type;
        */
        var pred = tokenList[i].content.pred;
        if (pred.startsWith("aux")) cat = "auxV";
        code["cat"] = cat;
        code["base"] = tokenList[i].content.base;
        code["pos"] = tokenList[i].content.pos;
        code["type"] = tokenList[i].content.type; // noun_mod, verb_mod
	code["pred"] = pred;
        var arg1 = tokenList[i].arg1; code["arg1"] = null;
        var arg2 = tokenList[i].arg2; code["arg2"] = null;
        var arg3 = tokenList[i].arg3; code["arg3"] = null;

        if (tokenList[i].content.pos != undefined)
            code["pos"] = tokenList[i].content.pos;

        // A cat arrived in the park. [cat arrived]の自動詞としてarrivedを分離するため。
        // 参考: 進行形 aspect = progressive, voice = active
	// ただし以下の処理は余計すぎるのではないか? 2019.2.15
        if (code["type"] == "noun_mod" &&
            tokenList[i].content.aspect == "none" && tokenList[i].content.voice == "passive") {
            code["cat"] = "V";
            if (arg2 != undefined) code["arg1"] = arg2.content.base;
            code["tense"] = "past";
            code["aspect"] = "none";
            code["voice"] = "none";
        } else {
            if (arg1 != undefined && code["arg1"] == null) code["arg1"] = arg1.content.base;
            if (arg2 != undefined && code["arg2"] == null) code["arg2"] = arg2.content.base;
        }
        if (arg3 != undefined && code["arg3"] == null) code["arg3"] = arg3.content.base;
        if (cat == "V") {
            code["tense"] = tokenList[i].content.tense;
            code["aspect"] = tokenList[i].content.aspect;
            code["voice"] = tokenList[i].content.voice;
        }
        if (cat == "CONJ" || cat == "PN") {
            code["base"] = tokenList[i].content.base;
            code["lexetry"] = tokenList[i].content.lexentry;
            //code["arg1"] = tokenList[i].content.arg1;
            //code["arg2"] = tokenList[i].content.arg2;
            if (tokenList[i].arg1 != undefined) code["arg1"] = tokenList[i].arg1.content.base;
            if (tokenList[i].arg2 != undefined) code["arg2"] = tokenList[i].arg2.content.base;
        }
        var base = tokenList[i].content.base;
        if (base == "where") { // for enju bug.
            code["pos"] = 'WRB';
        }

        //if (debugC) console.log("code = ", JSON.stringify(code));
        stack.push(code);
        code = {};
    }
    for (var i = 0; i < stack.length; i++) {
        if (eprint) console.log(JSON.stringify(stack[i]));
    }
    input["ecode"].push(stack);
    printInput(input);
    ecode = stack;
    tokenIdList = [];
    tokenList = [];

    //base:"-YEAR-" => "0622", base:"-NUMBER-" => "30"
    var mirai_split = (input['mirai_extend'])[0].split(' ');
    for(var i = 0; i < ecode.length; i++){
	if (ecode[i].pos == 'CD') ecode[i].base = mirai_split[i]
    }
}

function generateGcode(){

    var escode = generateEscode();
    var gtmp;
    console.log("escode:", escode);

    if (chat == false){
	gtmp = gcode(escode);	
	console.log("gscode:", gtmp);
	return gtmp;
    } else {
	gtmp = chatgen(escode);
	console.log("gscode:", gtmp);
	return gtmp;
    }
}

function generateEscode(){

    var i = 0;
    var escode = {};
    var estmp;

    var o = imperative(i);
    if (o.i != i){ //Please型の命令形
	escode = o; escode['stype'] = 'imperative'; return escode;
    }

    switch(ecode[i].base){
    case 'be': 
	// be there
	if (ecode[i+1].base == 'there'){
	    i++; i++; 
	    escode = scode(i,false); escode['stype'] = 'be_there'; i = escode.i;
	    break;
	}
	// be not there
	if (ecode[i+1].base == 'not' && ecode[i+2].base == 'there'){
	    i++; i++; i++;
	    escode = scode(i,false); escode['stype'] = 'be_not_there'; i = escode.i;
	    break;
	}
	escode = scode(i,false); i = escode.i; 
	break;
    case 'there': 
	// there be not
	if (ecode[i+1].base == 'be' && ecode[i+2] == 'not'){
	    i++; i++;
	    escode = scode(i,false); escode['stype'] = 'there_be_not'; i = escode.i;
	    break;
	}
	// there be
	if (ecode[i+1].base == 'be'){
	    i++; 
	    escode = scode(i,false); escode['stype'] = 'there_be'; i = escode.i;
	    break;
	}
	escode = scode(i,false); i = escode.i; 
	break;
    case 'when': case 'where': case 'why': case 'how':
	i++; escode = scode(i,false); escode['stype'] = ecode[i-1].base; i = escode.i;
	break;
    case 'which':
	var base = ecode[i].base;
	var way = '';
	// which way
	if (ecode[i].arg1 == ecode[i+1].base) { way = ecode[i+1].base; i++ } 
	if (way != '') base = base + '_' + way;
	i++; escode = scode(i,false); escode['stype'] = base; i = escode.i;
	break;
    case 'what': case 'who':
	var base = ecode[i].base;
	var something = '';
	// what temple
	if (ecode[i].arg1 == ecode[i+1].base) { something = ecode[i+1].base; i++ } 
	if (something != '') base = base + '_' + something;
	i++; escode = scode(i,false); escode['stype'] = base; i = escode.i;
	break;
    default:
	escode = scode(i,false); i = escode.i;
    }

    if (i > ecode.length-1) return escode;
    // where ..., which ..., who ...
    switch(ecode[i].base){
    case 'where': case 'anywhere':
	i++;  estmp = scode(i,false); escode['where'] = estmp; i =estmp.i;
	break;
    case 'that':
	i++;  estmp = scode(i,false); escode['which'] = estmp; i =estmp.i;
	break;
    case 'how': var a = ''; if (ecode[i+1].base == 'to') {i++; a = '_to'};
	i++;  estmp = scode(i,false); escode['how'+a] = estmp; i =estmp.i;
	break;
    case 'to':
	if (ecode[i].cat != 'C') break;
	i++; estmp = scode(i,true); escode['purpose'] = estmp; i = estmp.i;
    default:
	if (i < ecode.length){
	    estmp = unprocessed(i); escode['unprocessed'] = estmp; i = estmp.i;
	}
    }
    return escode;
}

function unprocessed(ti){

    var i = ti; var phrase = []; var o = {};
    while(i < ecode.length){
	phrase.push(ecode[i].base);
	i++;
    }
    o['i'] = i; o['phrase'] = phrase; return o;
}

function imperative(ti){
    var i = ti; var phrase = [];
    var o = {}; o['phrase'] = phrase; o['i'] = i;
    if (ecode[i].base != "please"){ return o };
    i++;
    o = scode(i,true);

    if (o.i < ecode.length){ //scodeで積み残したもの
	var rest = unprocessed(o.i);
	o['unprocessed'] = rest.phrase;
	o.i = rest.i;
	complement = rest.phrase[0];
    }

    return o;
}

function scode(ti, ps){ 

    //ps:provisional subject 仮主語
    var i = ti;
    var tmpi; 
    var so = {}; so['stype'] = 'affirmative'; //scode object
    var o; //scode temporay object
    var escode;
    var etmp;

    //助動詞 
    if(!ps){
	o = auxVerb(i); tmpi = o.i;
	if (i != tmpi){ so['v'] = o.phrase; so['i'] = tmpi; i = tmpi; so['stype'] = 'interrogate'; }
    }

    //動詞
    if(!ps){
	o = phraseVerb(i, so); tmpi = o.i;
	if (i != tmpi){ so['v'] = o.phrase; so['i'] = tmpi; i = tmpi; so['stype'] = 'interrogate'; }
    }
    if (i > ecode.length-1) return so;
        

    //主語
    if(!ps){
	o = phraseNoun(i, null); tmpi = o.i;
	if (i != tmpi){ so['s'] = o.phrase; so['i'] = tmpi; i = tmpi }
    }
    if (i > ecode.length-1) return so;

    //助動詞 
    o = auxVerb(i); tmpi = o.i; 
    if (i != tmpi){ so['v'] = o.phrase; so['i'] = tmpi; i = tmpi; }

    // be used
    // be going

    //動詞
    o = phraseVerb(i, so); tmpi = o.i;
    if (i != tmpi){ so['v'] = o.phrase; so['i'] = tmpi; i = tmpi; }
    if (i > ecode.length-1) return so;

    //代名詞
    if (ecode[i].pos == 'PRP'){
	so['obj1'] = ecode[i].base; i++;
	if (i > ecode.length-1) return so;
    }

    //目的語
    if (!(ecode[i].base == 'that' && ecode[i+1].arg1 == 'that')){
	//目的語の位置が、名詞に続くthat節でないとき
	o = phraseNoun(i,null); i = o.i; so['obj2'] = o.phrase; so['i'] = i; 
	if (i > ecode.length-1) return so;
    }


    //前置詞
    while (i < ecode.length && ecode[i].cat == 'P'){
	o = prepostion(i, so); tmpi = o.i;
	if (i != tmpi){ so[ecode[i].base] = o.phrase; so['i'] = tmpi; i = tmpi; }
	if (i > ecode.length-1) return so;
    }
    return so;
}

function phraseNoun(ti, targ){

    // ti:token index
    // targetで指定した範囲までを名詞句とする。一般的には直前の前置詞を受けて。
    var i = ti; var target = targ; var phrase = [];
    var o = {}; o['i'] = i; o['phrase'] = phrase; //返還オブジェクト
    if (ti == ecode.length) return o; //探索範囲オーバー

    /* 
    // let  me know ... meを主語としないため ==> 本来は「命令形」として処理すべき
    // ただし、tell me のケースには以下の記述は不要。
    if (i > 0 && ecode[i-1].cat == 'V' && ecode[i].cat == 'N' && 
	ecode[i-1].arg1 == null && ecode[i-1].arg2 == ecode[i].base) return o;
    */

    // 不定冠詞について。不定冠詞.arg1と次のトークン.arg1が等しい場合、targetを変更
    if (ecode[i].base == 'an' || ecode[i].base == 'a'){
	if (target == null && ecode[i].arg1 == ecode[i+1].arg1) target = ecode[i].arg1;
	i++; //いずれにしても不定冠詞a, anは読み飛ばす
    }
    else { // 他の冠詞すべてでtargetが与えられていなければ置き換える
	if (target == null && ecode[i].cat == 'D') target = ecode[i].arg1;
    }
    if (target != null){ // targetがある間、phraseにトークンを蓄える。
	while (i < ecode.length &&  ecode[i].base != target){phrase.push(ecode[i].base); i++; };
	phrase.push(ecode[i].base); i++; o.i = i; o.phrase = phrase; 
    } else { //targetが未定の場合はtargetまで読む
	if (ecode[i].base == 'a' || ecode[i].base == 'an') i++; //不定冠詞を読み飛ばす
	while (i < ecode.length && ecode[i].cat == 'N'){
	    //N〜Nの間に名詞化した動詞が入る。
	    phrase.push(ecode[i].base); 
	    if (ecode[i].pred == 'noun_arg0') {
		if (i+1 < ecode.length && ecode[i+1].base == "'s"){
		    i++; phrase.push(ecode[i].base); 
		}
		i++; break;
	    }
	    i++;
	}
	o.i = i; o.phrase = phrase; 
    }

    if (i > ecode.length-1) return o;
    // cat.N + cat.CD　あるいは cat.N + cat.ADJ。微妙。
    if (ecode[i].pos == 'CD'){
	o.phrase.push(ecode[i].base); i++; o.i = i;
    }
    return o;
}

/*
function verb_nounCheck(ecode, i){

   // ひかり特急券 hikari express[VB] ticket
   // 特急 Limited[VBN] express[VBP] to osaka
    if (ecode.base != 'be' && i < ecode.length && (ecode[i].pos == 'VB' || ecode[i].pos == 'VBP') &&
	ecode[i].arg1 == null && ecode[i].arg2 == null) return true;
   else false;
}
*/

function adjective(ti){ //形容詞
    //the tall beautiful man のように形容的に使われるものは問題なく処理される。
}

function auxVerb(ti){ //助動詞

    var i = ti; var phrase = []; var o = {}; o['i'] = i; o['phrase'] = phrase;
    if (i == ecode.length) return o;
    // want+toの場合、助動詞として扱う => want_to
    // have+to等も同じ
    if (ecode[i].base == 'want' && ecode[i+1].base == 'to'){
	phrase.push('want_to'); i = i+2; o.i = i; o.phrase = phrase; return o;
    }
    if (ecode[i].base == 'have' && ecode[i+1].base == 'to'){
	phrase.push('have_to'); i = i+2; o.i = i; o.phrase = phrase; return o;
    }
    if (ecode[i].base == 'would' && ecode[i+1].base == 'like' && ecode[i+2].base == 'to'){
	phrase.push('would_like_to'); i = i+3; o.i = i; o.phrase = phrase; return o;
    }
    if (ecode[i].base == 'do'){ 
	phrase.push('do'); i = i+1; o.i = i; o.phrase = phrase; 
	return o;
    }
    // 助動詞カテゴリauxVでなければ戻る。
    if (ecode[i].cat != 'auxV') return o;
    // 助動詞をoに保存
    // can Edy be used.=> [be, use]でcanが落ちる！
    phrase.push(ecode[i].base); i++; o.i = i; o.phrase = phrase; 
    if (i > ecode.length-1) return o;
    // 続いてnotが続く場合の処理を行う。
    if (ecode[i].base == 'not'){ (o.phrase).push('not'); i++; o.i = i;} //should not
    return o;
}

function phraseVerb(ti, so){ //動詞句

    var i = ti; var target; var phrase = []; var o = {}; o['i'] = i; o['phrase'] = phrase;
    if (i == ecode.length) return o;
    if (ecode[i].cat != 'V') return o;
    // 直前に助動詞があった場合、助動詞so['v']をphraseに取り出す
    if (so['v'] != undefined) phrase = so['v'];
    // 動詞名をphraseに追加。
    phrase.push(ecode[i].base); 
    // 動詞に続く助詞particleにつなげるため、particleをtargetに登録
    target = ecode[i].base; i++; o.i = i; o.phrase = phrase;
    if (i > ecode.length-1) return o;

    // 動詞+particle
    // カテゴリADVでもtargetと一致する場合は、助詞として扱える
    if (i < ecode.length && (ecode[i].cat == 'PRT' || (ecode[i].cat == 'ADV' && ecode[i].arg1 == target))) {
	phrase.push(ecode[i].base); i++; o.i = i; o.phrase = phrase;
    }
    if (i > ecode.length-1) return o;

    // 動詞+notの場合
    if (ecode[i].base == 'not'){ (o.phrase).push('not'); i++; o.i = i} //be not
    return o;
}


function prepostion(ti){ //前置詞句

    var i = ti; var target; var phrase = []; var o = {}; o['i'] = i; o['phrase'] = phrase;
    if (i == ecode.length) return o;
    if (ecode[i].cat != 'P') return o;
    //前置詞に続く名詞句の終わりを指定
    var target = ecode[i].arg2; 
    // 前置詞+現在進行系+名詞
    var prog_verb = null;
    // using+somethingがあったら
    if (ecode[i+1].cat == 'V' && ecode[i+1].aspect == 'progressive'){ 
	//動詞のarg2を新しいtargetとする。
	target = ecode[i+1].arg2; i++; 
	prog_verb = ecode[i].base;
    }
    i++;
    // 前置詞句の名詞部分をphraseNounを使い集める
    o = phraseNoun(i, target); i = o.i; 
    // 前置詞に続く動詞を集めたphraseの先頭に追加
    if (prog_verb != null) o.phrase.unshift(prog_verb); 
    return o;
}

function gremlinAPI (query){
    console.log("query:", query);
    var params_text = query.replace(/\s+/g, "");
    var gremlinURL = "http://ec2-52-192-173-39.ap-northeast-1.compute.amazonaws.com:3001/misc/gremlin/";
    var url = gremlinURL + encodeURIComponent(params_text);
    var request = require('sync-request');
    var res = request('GET', url);
    return JSON.parse(res.getBody('utf8'));
}


function gcode(escode){
    var gtmp = {};
    switch(escode.stype){
    case 'be_there': 
	gtmp["gdb"] = genPattern3(genVariable(0), pickNoun(escode.s, escode));
	break;
    case 'there_be': break;
    case 'what': 
	var s = escode.s;
	gtmp["gdb"] = genPattern1(genVariable(0), pickNoun(s, escode));
	break;
    case 'where':
	var s = escode.s; var v = escode.v; var obj2 = escode.obj2; var nfor = escode.for;
	//{ stype: 'where', s: [ 'be' ], obj2: [ 'the', 'firework' ], unprocessed: { phrase: [ 'display' ] } }
	if (v == undefined && s[0] == 'be' && obj2 != undefined){
	    gtmp["gdb"] = genPattern3(genVariable(0), pickNoun(obj2, escode));
	}
	//{ stype: 'where', v: [ 'be' ], s: [ 'the', 'bus', 'stop' ], obj2: [], for: [ 'okazaki', 'park' ] };
	else if (v[0] == 'be' && nfor != undefined ){
	    gtmp["gdb"] = genPattern4(genVariable(0), genVariable(1), 'go', pickNoun(s), pickNoun(nfor));
	}
	//{ stype: 'where', v: [ 'be' ], s: [ 'restroom' ] }
	//{ stype: 'where', v: [ 'be', 'hold' ], s: [ 'the', 'firework' ] }
	else if (v[0] == 'be'){
	    gtmp["gdb"] = genPattern3(genVariable(0), pickNoun(s, escode));
	}
	//{ stype: 'where', v: [ 'can', 'go' ], s: [ 'we' ], obj2: [], unprocessed: { phrase: [ 'cherry', 'blossom', 'viewing' ] } }
	else if (obj2 != undefined && emptyArray(obj2)){
	    gtmp["gdb"] = genPattern2(genVariable(0), pickVerb(v, escode), pickNoun(escode.unprocessed.phrase, escode));
	}
	//{ stype: 'where', v: [ 'do', 'sell' ], s: [ 'they' ], obj2: [ 'soba' ] };
	else if (obj2 != undefined && !emptyArray(obj2)){
	    gtmp["gdb"] = genPattern2(genVariable(0), pickVerb(v, escode), pickNoun(obj2, escode));
	}
	//{ stype: 'where', v: [ 'can', 'smoke' ], s: [ 'i' ] };
	else{
	    gtmp["gdb"] = genPattern0(genVariable(0), pickVerb(v, escode));
	}
	break;
    case 'imperative': break;
    case 'affirmative':
	var target;
	if (escode.obj2.length > 0 && pickNoun(escode.obj2, escode) != 'place') target = escode.obj2;
	else target = escode.where.s;
	gtmp["gdb"] = genPattern2(genVariable(0), pickVerb(escode.v, escode), pickNoun(target, escode));
	break;
    default:
	gtmp["gdb"] = "fail";
	break;
    }
    return gtmp;
}

function emptyArray(a){
    return(a.length == 0);
}

function pickNoun(noun, escode){
    console.log("noun-start:", noun);
    if (noun == undefined) return undefined;
    var token; var i;
    console.log("noun[0]:", noun[0]);
    if (noun[0] == 'the'){ token = noun[1]; i = 2 }
    else if (noun[0] == 'be') { token = noun[1]; i = 2 } // for unprocessed 'be'
    else { token = noun[0]; i = 1 }
    while (i < noun.length){
	if (noun[i] == "'s") {i++; continue;} //skip
	token = token + '-' + noun[i]; i++
    }
    console.log("noun-end:", token);
    return token;
}

function pickVerb(verb,escode){
    if (verb == undefined) return undefined;
    switch(verb[0]){
    case 'want_to': return verb[1];
    case 'can': 
	if (verb[1] == 'not') return 'not-'+verb[2];
	else return verb[1];
    case 'do': return verb[1];
    case 'be': if (verb.length >= 2) return 'be'+"-"+verb[1]; // [be, gone]
    default: 
	if (complement == null) return verb[0];
	else return verb[0]+"-"+complement;
    }
}

function genVariable(indx){
    var symbol = 'a';
    return String.fromCharCode(symbol.charCodeAt(0)+indx);

}

function addquote(name){
    return "\'"+name+"\'";
}

function genPattern0(v1, el1){ //関係対象を知りたい
    var s = "g.V().match(__.as(V1).in(EL1)).select(V1)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/EL1/g, addquote(el1));
    return s;
}

function genPattern1(v1, vl1){ //対象VL1そのものの情報を知りたい
    var s = "g.V().match(__.as(V1).has(label, of(VL1))).select(V1)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/VL1/g, addquote(vl1));
    return s;
}

function genPattern2(v1, el1, vl1){ //具体的な対象VL1へ行く手段を知りたい
    var s = "g.V().match(__.as(V1).in(EL1).has(label, of(VL1))).select(V1)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/EL1/g, addquote(el1));
    s = s.replace(/VL1/g, addquote(vl1));
    return s;
}

function genPattern3(v1, vl1){ //対象VL1が一般名詞,固有名詞両方を持つ場合
    var s = "g.V().match(__.as(V1).out('instanceOf').has(label, of(VL1))).select(V1)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/VL1/g, addquote(vl1));
    return s;
}

function genPattern4(v1, v2, el1, vl1, vl2){
    var s = "g.V().match(__.as(V1).has(label, of(VL1)), __.as(V1).out('instanceOf').as(V2),__.as(V2).in(EL1).has(label, of(VL2))).select(V2)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/V2/g, addquote(v2));
    s = s.replace(/EL1/g, addquote(el1));
    s = s.replace(/VL1/g, addquote(vl1));
    s = s.replace(/VL2/g, addquote(vl2));
    return s;
}

function chatgen(escode){
    if(escode.stype == 'imperative'){
	return(imperativeOrder(escode));
    }
    else if (escode.stype == 'affirmative'){
	return(affirmativeOrder(escode));
    }
    else{
	return undefined;
    }
}

function imperativeOrder(escode){

    var v = pickVerb(escode.v, escode); 
    var obj1 = pickNoun(escode.obj1, escode);
    var obj2 = pickNoun(escode.obj2, escode);
    var of = pickNoun(escode.of, escode);
    var gcode = {}; var o = {};

    //{ v: [ 'give' ], obj1: 'me', obj2: [ 'list' ],  of: [ 'correct', 'answer' ] }
    //{ v: [ 'give' ], obj1: 'me', obj2: [ 'list' ],  of: [ 'incorrect', 'answer' ] }
    //{ v: [ 'give' ], obj1: 'me', obj2: [ 'list' ],  of: [ 'unanswered', 'question' ] }
    //{ v: [ 'cancel' ], obj2: [ 'the', 'number', '3', 'bus', 'stop' ] }
    //{ v: [ 'make' ], obj2: [ 'the', 'number', '3', 'bus', 'stop' ], unprocessed: [ 'available' ] }
    //   in pickVerb() v-> make-available

    if (v == 'give' && obj2 == 'list' && of != undefined){
	var otmp = {}; otmp['v'] = 'list'; otmp['obj'] = of;
	o['order'] = otmp; gcode["chat_out"] = o;
	return gcode;
    }
    var otmp = {}; otmp['v'] = v; otmp['obj'] = obj2;
    o['order'] = otmp; gcode["chat_out"] = o;
    return gcode;

}

function affirmativeOrder(escode){

    var s = pickNoun(escode.s, escode);
    var v = pickVerb(escode.v, escode); 
    var obj1 = pickNoun(escode.obj1, escode);
    var obj2 = pickNoun(escode.obj2, escode);
    var nfor = pickNoun(escode.for, escode);
    var gcode = {}; var o = {};

    //{ s: [ 'the', 'smoking', 'area' ], v: [ 'be' ], obj2: [],  where: { s: [ 'you' ], v: [ 'can', 'smoke' ] } }
    if (v == 'be' && obj2 == undefined && escode.where != undefined){
	var otmp = {}; otmp['s'] = s; otmp['def'] = pickVerb(escode.where.v,escode);
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }

    //{ s: [ 'the', 'bus', 'stop' ], obj2: [],  for: [ 'okazaki', 'park' ],  unprocessed: { phrase: [ 'be', 'number', '3' ] } }
    console.log("imperative:", escode);
    if (nfor != undefined && escode.unprocessed != undefined){
	var otmp = {}; otmp['s'] = s; otmp['for'] = nfor; otmp['def'] = pickNoun(escode.unprocessed.phrase, escode);
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }

    //{ s: [ 'mcdonald', '\'s' ], v: [ 'can', 'not', 'smoke', 'anymore' ] }
    //{ s: [ 'the', 'number', '3', 'bus', 'stop' ],  v: [ 'be', 'go' ] }
    if (v != 'be' && obj2 == undefined){
	var otmp = {}; otmp['s'] = s; otmp['v'] = v; 
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }

    //{ s: [ 'tetsuhaku' ], v: [ 'be' ], obj2: [ 'another', 'name' ], for: [ 'railway', 'museum' ] }
    if (v == 'be' && obj2 == 'another-name'){
	var otmp = {}; otmp['s'] = s; otmp['alias_of'] = nfor; 
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }
    return undefined;
}


//console.log(gremlinAPI("g.V().match(__.as('x').out('change').has(label,of('オムツ')).select('x'))"));


// ------------------------------------------------------
// 入力テスト
// > 入力文
// if batch == true then バッチテスト、load from "test_in_sample.js"
// if batch == false then インタラクティブ
// ------------------------------------------------------

// ----------
// 入力テスト
// ----------
/*
if (batch){ //バッチテスト
    var text = [];
    var textid = 0;
    var testin = require('./test_in_sample.js');
    var example = testin.make();

    for (var i = 0; i < example.length; i++){
	text[i] = example[i];
    }
    var readline = require('readline'),
    rl = readline.createInterface(process.stdin, process.stdout),
	prefix = '\n> ';

    rl.on('line', function(line0) {
	if (textid < text.length){ // デモ中
	    var line = text[textid]; textid++;
	} else if (isNaN(line0.charCodeAt(0))){ // Enterキー
	    noEmpty = false;
	} else{ // リアル入力
	    line = line0;
	}
	try{
	    if (noEmpty) {
		console.log(line);
		interpreter(line);
	    }

	} catch(e){
	    console.log("問題が起きました。",e);
	} finally {
	    noEmpty = true;
	    rl.prompt();
	}

    }).on('close', function() {
    console.log('batch test end');
    process.exit(0); // needed for the process ending
    });
    
    rl.setPrompt(prefix, prefix.length);
    rl.prompt();
    }
else { //インタラクティブテスト
    
    // テストデータ入力および結果の出力
    var readline = require('readline'),
    rl = readline.createInterface(process.stdin, process.stdout),
	prefix = '\n> ';
    var noEmpty = true;
    rl.on('line', function(line0) {
	if (isNaN(line0.charCodeAt(0))){ // Enterキー
	    noEmpty = false;
	} else{ // リアル入力
	    //line = line0;
	}
	try{
	    if (noEmpty) {
		interpreter(line0);
	    }
	} catch(e){
	    console.log("問題が起きました。",e);
	} finally {
            noEmpty = true;
	    rl.prompt();
	}
    }).on('close', function() {
	console.log('exit');
	process.exit(0);
    });
    console.log('会話テスト');
    rl.setPrompt(prefix, prefix.length);
    rl.prompt();
}
*/

module.exports = function (language, mode_flag, line) {
    return interpreter(language, mode_flag, line);
}
