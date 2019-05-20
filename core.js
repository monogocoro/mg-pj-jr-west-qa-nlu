//
// Nutural Language Understanding
//   matsuda@monogocoro.co.jp   2019.3 ver0.4
//      (a) queryモード input: line=文字列, output: {gscode: Gremlinコード}
//      (b) CHATモード
//            input: line={chat_in: 文字列}
//            output: {gscode: JSONコード}

// 【全体の構成】
//
// カーネルトップ： function interpreter(line)
//   enjujs = get_enju_json(line, language)
//   
//   in get_enju_json
//      text = j2e_replace(text) 翻訳で失敗しそうな単語をローマ字化する
//      mirai = get_ja2en(text) 翻訳みらいを使用し、和文を英文に変換する
//      enjujs = get_enju_xml(mirai) みらいの結果[英文]をenjuに掛け、XML形式の出力を得る
//      => xmlをJSON化し、戻り値 enjujs とする。
// 
//   in findTokenList(enjujs)
//      最後。JSON.stringify(JSON.parse(parsed), getToken)はgetTokenを呼び出す。
//   
//      getToken(key, value)の実行によって、副作用としてnodemark[節]、tokens[終端]を生成
// 
//   interpreter()に戻る
//     createTokenObjects(tokens) 
//        nodemarkを利用し、tokensの中身をオブジェクト化しtokenListに残す。
//        この時点で、tokensの中身は消去。
//
//   in resolveArgLinks()
//     tokenList内を探索し、主としてarg1, arg2, arg3の参照関係を調整する。
// 
//   in generateCode(line)  lineを引き渡しているので原文を利用するため。現在未利用。
//        tokenListを利用し、ecode(大域変数)を生成
//
//   in generateGcode() gcodeを生成

'use strict';
var _ = require('lodash');
var debugC = false;  // enju木出力
var eprint = false; // ecode出力

// --------------------
// システムインタプリタ
// -------------------


var noEmpty = true; //入力状態を制御
var dialog = "none"; // dialogモード切り替え
var dialogmode; // interpeter引数 dialog_modeの保持
var complement = null; 
   // make it availableでavailableを未処理で残して場合。
   // 具体的にはunprocessedの中で設定し、pickVerbの中で使用する。

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

var input = {}; //protocol stack for line, ecode, etc:
input['type'] = 'AFF';
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

// interpreter()実行時、情報(JSON)をファイルを介して利用する 5/18
var jsonfile = require('jsonfile');
function jsonWrite(file, json){
    jsonfile.writeFileSync(file, json, {
        encoding: 'utf-8', 
	replacer: null, 
	spaces: null
	}, function (err) {
	});
}
function jsonRead(file){
    var data;
    data = jsonfile.readFileSync(file, {
	encoding: 'utf-8', 
	reviver: null, 
	throws: true
	});
    return data;
}
//jsonWrite('context.json', {dialog:{a:1,b:2,c:["apple","orange"]}});
//var data = jsonRead('context.json');
//console.log(data.dialog); //{a:1,b:2,c:["apple","orange"]}

// 文脈関連関数 5/17
function contextRegister(type, json){
    var file = 'context'+type+'.json';
    jsonWrite(file, json);
}

function contextRead(type){
    var file = 'context'+type+'.json';
    var data = jsonRead(file);
    return data;
}

function contextFrame(type){
    switch(type){
    case "meeting":
	return {reserve: {title: null,  started_at: null, finished_at: null,  place: null, participants: null}};
    }
}

function contextTypeSet(escode){
    if (escode.stype == 'affirmative' && association(escode.s, 'meeting')){
	contextRegister('type', 'meeting');
    }
    else contextRegister('type', 'unknown');
}

function contextType(){
    var data = contextRead('type');
    return data;
}
//contextTypeSet({stype: 'affirmative', s:['aaa', 'meeting']});
//console.log(contextType());

function association(arr, a){
    // 本来はコロケーションや連想記憶、あるいは文脈から判断
    // 5/17 まずはここから。
    if (arr.indexOf(a) != -1) return true;
    else return false;
}

//contextRegister('meeting', '{reservation: {data: 1}}');
//console.log(contextRead('meeting'));
//console.log(contextFrame('meeting'));

function interpreter(language, mode_flag, dialog_mode, line0){

    dialogmode = dialog_mode;
    // 引数説明
    //    language: 'japanese' | 'english'
    //    mode_flag: 'none'（通常) | 'select'（選択） | 'command'（音声コマンド）
    //    5/17追加 dialog_mode: 'learning' (学習モード) | 'information' (情報提供モード)
    //var line = voice_correct(line0); // 音声入力からテキスト変換の誤りを訂正

    // all reset for global variables in this code
    nodemarks = [];
    tokens = [];
    tokenIdList = [];
    tokenList = [];
    complement = null;
    dialog = "none";

    //変換の途中結果を保持
    input["line"] = [];
    input["j2e_replace"] = [];
    input["mirai"] = [];
    input["mirai_extend"] = [];
    input["enju"] = [];
    input["ecode"] = [];

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

    function dialogType(line){ // 5/17
	var type = "none";
	if (line.indexOf('{chat_in') != -1) type = "chat";
	else if (line.indexOf('{user') != -1) type = "user";
	else if (line.indexOf('{character') != -1) type =  "character";
	else if (line.indexOf('{learning') != -1) type =  "learning";
	else if (line.indexOf('{information') != -1) type =  "information";
	return type;
    }

    if (dialogType(line0) != "none"){
	dialog = dialogType(line0);
	line0 = eval(line0);
    }

    var line = line0;

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
// j2e_replace: enju処理前に日本語を英語になおす
//
function get_j2edic(){ //GraphDB
    var url="http://ec2-52-192-173-39.ap-northeast-1.compute.amazonaws.com:3001/j2edics.json";
    var request = require('sync-request');
    var res = request('GET', url);
    //console.log(JSON.parse(res.getBody('utf8')));
    return JSON.parse(res.getBody('utf8'));

}
var j2edic = get_j2edic(); //j2edicデータ

function j2e_replace(s){
    var i = 0;
    while (i < j2edic.length){
	var replaced = s.replace(j2edic[i].wamei, j2edic[i].romaji);
	if (s != replaced){
	    return replaced;
	}
	i++;
    }
    return s;
}

//
// 複文を単文に変換
//
// *** 駄目！***
// 複文処理、あるいは「,」処理を正確に

function double2single(s){
    // 現状 ", and" あるいは ", or", ", then" に対処
    var modified = s;
    // 暫定処理。ちゃんと汎用化！
    modified = modified.replace(", and", " and");
    modified = modified.replace(", or", " or");
    modified = modified.replace(", then", " then");
    return modified;
}
//console.log(double2single("I left something on the train, then wWhere should I go?"));

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
    else { //日本語
	var text = j2e_replace(text0); //みらいに掛ける前の前処理
	input["j2e_replace"].push(text);
	// 日本語 => English
	mirai = get_ja2en(text);
	mirai = preprocessing_time(mirai);
	//mirai = double2single(mirai); 
    }
    input["mirai_extend"].push(tokenSplit(mirai));
    input["mirai"].push(mirai);

    var xml = get_enju_xml(mirai); //enju呼び出し、結果はxml
    var json = {};
    parseString(xml, function (err, result) { //enju.xml => enju.json
        json = JSON.stringify(result);
    });
    if (debugC) input["enju"].push(json);
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
function get_ja2en(text) { //call みらい
    
    var params_text = text.replace(/\s+/g, "");
    var url = 'https://preprocessor.monogocoro.ai/ja2en/' + encodeURIComponent(params_text);
    // for goolish: add "?google=True" in the last of the sentence
    var request = require('sync-request');
    var res = request('GET', url);
    console.log(res.getBody('utf8'));
    return res.getBody('utf8');

}

// get_enju_json 補助関数: get_enju_xml
function get_enju_xml(text0) { //call enju
    
    var text = text0;
    var url = 'https://preprocessor.monogocoro.ai/en2enju_xml/' + encodeURIComponent(text);
    var request = require('sync-request');
    var res = request('GET', url);
    return res.getBody('utf8');
}

function preprocessing_time(s){

    // miraiにかけたあとenjuに投入する前に処理。主として、:の扱い。
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
	//stack = _.union(stack, r); バグ。rの予想でstackに「ないもの」だけを足していた
	stack = join(stack, r);
    }

    var ss = "";
    for (var i = 0; i < stack.length-1; i++){
	ss = ss + stack[i] + " ";
    }
    ss = ss + stack[i];
    return ss;
}

function join(A,B){
    //配列Aの後ろに配列Bの中身を足す
    var a = A;
    for (var i = 0; i < B.length; i++) a.push(B[i]);
    return a;
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
    
    if (key == "nodemark")  nodemarks.push(value);
    if (key == "tok")  tokens.push(value);
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

        if (debugC) console.log("code = ", JSON.stringify(code));
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

    //5/17 ここでenjuで生じる-NUMBER-を実データで置き換えてる。
    //base:"-YEAR-" => "0622", base:"-NUMBER-" => "30" base:"-NUMBER-rd" => "3rd"
    var mirai_split = (input['mirai_extend'])[0].split(' ');
    for(var i = 0; i < ecode.length; i++){
	if (ecode[i].pos == 'CD' || ecode[i].base == "-NUMBER-rd") ecode[i].base = mirai_split[i]
    }
}


// -- generateGcode() ------------------------------------------------ 
// 
// generateEscode()でescodeを利用。
// escoeeはecode[enju解析出力]から各種カテゴリを含め、文構造を再構成する
// 通常の質問に対しては、gcode(escode)を呼び出し、
// chat形式の場合は、chatgen(escode)を呼び出す。
// --------------------------------------------------------------------

function generateGcode(){

    var escode = generateEscode();
    var gtmp;
    console.log("escode:", escode);
    if (dialog == "none"){
	gtmp = gcode(escode);	
	console.log("gscode:", gtmp);
	return gtmp;
    } else if (dialog == "chat") {
	gtmp = chatgen(escode);
	console.log("gscode:", gtmp);
	return gtmp;
    } else if (dialog == "user") {
	gtmp = usergen(escode);
	console.log("gscode:", gtmp);

    } else if (dialog == "character") {
	gtmp = charactergen(escode);
	console.log("gscode:", gtmp);
    }
}

// -- generateEscode()
//
// 


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
	// 5/20 "why" 単独時、iが未定義になる。
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
	break;
    default:
	i++; estmp = scode(i,false); escode['unknown'] = estmp; i = estmp.i;
	break;
    }
    if (i < ecode.length){
	estmp = unprocessed(i); escode['unprocessed'] = estmp; i = estmp.i;
    };
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
    // 5/20 so['i'] = i;を追加。ecodeが一語の時に対応。
    var so = {}; so['stype'] = 'affirmative'; so['i'] = i;//scode object
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
    /* 5/17 for andClause()
    if(!ps){
	o = phraseNoun(i, null); tmpi = o.i;
	if (i != tmpi){ so['s'] = o.phrase; so['i'] = tmpi; i = tmpi }
    }
    */
    if(!ps){
	o = andClause(i);
	if (o.i != i){ // and clause exists as subject
	    so['s'] = o.phrase; so['i'] = o.i; i = o.i;
	} else { // check a single subject
	    o = phraseNoun(i, null); tmpi = o.i;
	    if (i != tmpi){ so['s'] = o.phrase; so['i'] = tmpi; i = tmpi }
	}
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
    if (i == ecode.length) return o; //探索範囲オーバー

    // 不定冠詞について。不定冠詞.arg1と次のトークン.arg1が等しい場合、targetを変更
    if (ecode[i].base == 'an' || ecode[i].base == 'a'){
	if (target == null && ecode[i].arg1 == ecode[i+1].arg1) target = ecode[i].arg1;
	i++; //いずれにしても不定冠詞a, anは読み飛ばす
    }
    else { // 他の冠詞すべてでtargetが与えられていなければ置き換える
	if (target == null && ecode[i].cat == 'D') target = ecode[i].arg1;
    }
    if (target != null){ // targetがある間、phraseにトークンを蓄える。
	// console.log("ecode[i]:",ecode[i]); 5/16
	while (i < ecode.length &&  ecode[i].base != target){
	    //console.log("target:",target, " base:", ecode[i].base); // 5/17
	    phrase.push(ecode[i].base); i++; 
	};
	if (i < ecode.length) phrase.push(ecode[i].base); i++; o.i = i; o.phrase = phrase;  // 5/16
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

function andClause(i){ // 5/17 added
    /*
    mirai: Suehiro-san, Tanaka-san, Chiba-san and Matsuda-san.
    ecode:
    {"cat":"N","base":"suehiro-san","pos":"NNP","pred":"noun_arg0","arg1":null,"arg2":null,"arg3":null}
    {"cat":"CONJ","base":"-COMMA-","pos":",","pred":"coord_arg12","arg1":"suehiro-san","arg2":"tanaka-san","arg3":null,"lexetry":"[N<CONJP>N]"}
    {"cat":"N","base":"tanaka-san","pos":"NNP","pred":"noun_arg0","arg1":null,"arg2":null,"arg3":null}
    {"cat":"CONJ","base":"-COMMA-","pos":",","pred":"coord_arg12","arg1":"-COMMA-","arg2":"chiba-san","arg3":null,"lexetry":"[N<CONJP>N]"}
    {"cat":"N","base":"chiba-san","pos":"NNP","pred":"noun_arg0","arg1":null,"arg2":null,"arg3":null}
    {"cat":"CONJ","base":"and","pos":"CC","pred":"coord_arg12","arg1":"-COMMA-","arg2":"matsuda-san","arg3":null,"lexetry":"[N<CONJP>N]"}
    {"cat":"N","base":"matsuda-san","pos":"NNP","pred":"noun_arg0","arg1":null,"arg2":null,"arg3":null}
    */

    var o = {}; var ac = [];
    if (i == ecode.length-1){
	o["i"] = i; o["phrase"] = ac;
    }
    if (i+1 < ecode.length && ecode[i+1].cat != "CONJ"){
	o["i"] = i; o["phrase"] = ac;
    }
    if (i+1 < ecode.length && ecode[i+1].cat == "CONJ"){
	var ac = []; ac.push(ecode[i].base); i++;
	while(i < ecode.length && ecode[i].cat == "CONJ"){
	    ac.push(ecode[i+1].base); i=i+2;
	}
	o["i"] = i; o["phrase"] = ac;
	//console.log("andClause:", o);
    }
    return o;
}


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

const empty = 'empty'; //key-valueのvalueは存在し、value = []のとき。 value = empty
                       //valueそのものがないときは、value = undefine

//【Gremlinコード生成】 --- gcode(escode)
//
// escodeのstype（文タイプ）および文構造からgenPatternのタイプを選択
// 当然、escode引いては、和文=>英文ツールおよびenjuの解析結果に依存。止む終えない依存。
function gcode(escode){

    var gtmp = {};
    var var0 = genVariable(0); var var1 = genVariable(1); 
    var s = pickNoun(escode.s, escode);
    var v = pickVerb(escode.v, escode);
    var obj2 = pickNoun(escode.obj2, escode);
    switch(escode.stype){
    case 'be_there': 
	gtmp["gdb"] = genPattern3(var0, s);
	break;
    case 'there_be': break;
    case 'what': 
	gtmp["gdb"] = genPattern1(var0, s);
	break;
    case 'where':
	//{ stype: 'where', s: [ 'be' ], obj2: [ 'the', 'firework' ], unprocessed: { phrase: [ 'display' ] } }
	if (v == undefined && s == 'be' && obj2 != empty){
	    gtmp["gdb"] = genPattern3(var0, obj2);
	}
	//{ stype: 'where', v: [ 'be' ], s: [ 'the', 'bus', 'stop' ], obj2: [], for: [ 'okazaki', 'park' ] };
	else if (v == 'be' && escode.for != undefined ){
	    var nfor = pickNoun(escode.for, escode);
	    gtmp["gdb"] = genPattern4(var0, var1, 'go', s, nfor);
	}
	//{ stype: 'where', v: [ 'be' ], s: [ 'restroom' ] }
	//{ stype: 'where', v: [ 'be', 'hold' ], s: [ 'the', 'firework' ] }
	else if (v == 'be' || v == 'be-hold'){
	    gtmp["gdb"] = genPattern3(var0, s);
	}
	//{ stype: 'where', v: [ 'can', 'go' ], s: [ 'we' ], obj2: [], unprocessed: { phrase: [ 'cherry', 'blossom', 'viewing' ] } }
	else if (obj2 == empty && escode.unprocessed != undefined){
	    gtmp["gdb"] = genPattern2(var0, v, pickNoun(escode.unprocessed.phrase, escode));
	}
	//{ stype: 'where', v: [ 'do', 'sell' ], s: [ 'they' ], obj2: [ 'soba' ] };
	else if (obj2 != undefined){
	    gtmp["gdb"] = genPattern2(var0, v, obj2);
	}
	//{ stype: 'where', v: [ 'can', 'smoke' ], s: [ 'i' ] };
	else{
	    gtmp["gdb"] = genPattern0(var0, v);
	}
	break;
    case 'imperative': break;
    case 'affirmative':
	var target = pickNoun(escode.s, escode); // 5/20 単語のみをwhere句とする
	if (v == undefined) v = 'go';
	//console.log("v:", v);
	// 5/17 "escode.obj2 != undefined &&" added
	if (escode.obj2 != undefined && escode.obj2.length > 0 && obj2 != 'place') target = obj2;
	else if (escode.where != undefined) {
	    target = pickNoun(escode.where.s, escode);
	}
	else if (escode.to != undefined){ // I want to go to A. 
	    target = pickNoun(escode.to, escode);
	}
	gtmp["gdb"] = genPattern2(var0, v, target);
	break;
    default:
	gtmp["gdb"] = "fail";
	break;
    }
    return gtmp;
}

//【Gremlinコードのパターン】
// 
// escodeからgremlinコード（dot連接）への変換アルゴリズム未定。現状は予め用意したパターンへの埋込で対応。
// したがって現状では、必要に応じてパターンを増やす戦略を取る。

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

function genPattern3(v1, vl1){ //対象がクラスVL1のインタンスである場合
    var s = "g.V().match(__.as(V1).out('instanceOf').has(label, of(VL1))).select(V1)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/VL1/g, addquote(vl1));
    return s;
}

function genPattern4(v1, v2, el1, vl1, vl2){//クラスV1に対しインスタンスV2が関係する場合。
    var s = "g.V().match(__.as(V1).has(label, of(VL1)), __.as(V1).in('instanceOf').as(V2),__.as(V2).in(EL1).has(label, of(VL2))).select(V2)";
    s = s.replace(/V1/g, addquote(v1));
    s = s.replace(/V2/g, addquote(v2));
    s = s.replace(/EL1/g, addquote(el1));
    s = s.replace(/VL1/g, addquote(vl1));
    s = s.replace(/VL2/g, addquote(vl2));
    return s;
}

function genVariable(indx){ // with indx = 3 => 'a3'
    var symbol = 'a';
    return String.fromCharCode(symbol.charCodeAt(0)+indx);
}
function addquote(name){ return "\'"+name+"\'" } // 'name' => "'name'"

//【名詞配列から主要部分を取り出す】pickNoun(noun, escode)
//
// 名詞配列の形式はescode（生成はgenerateEscode())に依存。
// nounの例: [the, manga, museum] => token: manga-museum
// noun配列冒頭部分の処理
//   case1: theは排除
//   case2: {unprocessed: [be, ..]}の場合、beを排除
//   default: noun[0]をtokenの先頭とする。
// noun配列要素をすべて"-"で連接。
// A's のような場合、noun=[A, 's]となり、'sを（今は）排除。
function pickNoun(noun, escode){

    if (noun == undefined) return undefined;
    if (emptyArray(noun)) return empty;
    var token; var i;
    if (noun[0] == 'the'){ token = noun[1]; i = 2 }
    else if (noun.length > 1 && noun[0] == 'be') { token = noun[1]; i = 2 } // for unprocessed 'be'
    else { token = noun[0]; i = 1 }
    while (i < noun.length){
	if (noun[i] == "'s") {i++; continue;} //skip
	token = token + '-' + noun[i]; i++
    }
    return token;
}

//【動詞配列から主要部分を取り出す】pickVerb(verb,escode)
//
// 動詞配列の形式はescode（生成はgenerateEscode())に依存。
// [want_to, v] => v
// [can, not, v] => not-v
// [can, v] => v
// [do, v] => v
// [be, not] => be-not
// [be, v(passive)] => be-v
// [be] => be
// 補語complementがあるとき、v-complement
function pickVerb(verb,escode){

    if (verb == undefined) return undefined;
    if (emptyArray(verb)) return empty;
    switch(verb[0]){
    case 'want_to': return verb[1];
    case 'can': 
	if (verb[1] == 'not') return 'not-'+verb[2];
	else return verb[1];
    case 'do': return verb[1];
    case 'be': 
	if (verb.length == 2 && verb[1] == 'not') return 'be-not';
	else if (verb.length >= 2) return 'be'+"-"+verb[1]; // [be, gone]
	else return 'be';
    default: 
	if (complement == null) return verb[0];
	else return verb[0]+"-"+complement;
    }
}

function emptyArray(a){ return(a.length == 0 ) } // [] => true

// 【チャットやりとり】chatgen(escode)
//
// 入力: {chat_in: ...} 出力: {chat_out: ...}
// 入力escode はlineがgenerateEscode()で処理され生成されたもの。
function chatgen(escode){

    if(escode.stype == 'imperative'){
	return(imperativeOrder(escode));
    }
    else if (escode.stype == 'there_be' && dialogmode == 'learning'){
	return(dialogLearning(escode));
    }
    else if (escode.stype == 'affirmative' && dialogmode == 'learning'){
	return(dialogLearning(escode));
    }
    else if (escode.stype == 'affirmative' && dialogmode == 'information'){
	return(dialogInformation(escode));
    }
    else if (escode.stype == 'affirmative'){
	return(affirmativeOrder(escode));
    }
    else{
	return undefined;
    }
}

//【命令形】imperativeOrder(escode)
//
// 英語化した場合、先頭動詞が名詞化しない、ことが前提。
// Pleaseが先頭についた場合は、確実に名詞化しない。
// しかし、単なる動詞の場合は動詞化する方が少ない！
//
// 「場合分け」の課題。if then else ではなく意味的パターンマッチに変更したい。
//  ただし、srules.jsと組み合わせたパターンマッチは動的な情報を使えない、
//  局所的な単一パターンマッチであり、使い勝手が悪い。
function imperativeOrder(escode){

    var v = pickVerb(escode.v, escode); 
    var obj1 = pickNoun(escode.obj1, escode);
    var obj2 = pickNoun(escode.obj2, escode);
    var of = pickNoun(escode.of, escode);
    var gcode = {}; var o = {};

    //{ v: [ 'give' ], obj1: 'me', obj2: [ 'list' ],  of: [ 'correct', 'answer' ] }
    //{ v: [ 'give' ], obj1: 'me', obj2: [ 'list' ],  of: [ 'incorrect', 'answer' ] }
    //{ v: [ 'give' ], obj1: 'me', obj2: [ 'list' ],  of: [ 'unanswered', 'question' ] }
    if (v == 'give' && obj2 == 'list' && of != undefined){
	var otmp = {}; otmp['v'] = 'list'; otmp['obj'] = of;
	o['order'] = otmp; gcode["chat_out"] = o;
	return gcode;
    }
    //{ v: [ 'cancel' ], obj2: [ 'the', 'number', '3', 'bus', 'stop' ] }
    //{ v: [ 'make' ], obj2: [ 'the', 'number', '3', 'bus', 'stop' ], unprocessed: [ 'available' ] }
    //   in pickVerb() v-> make-available
    var otmp = {}; otmp['v'] = v; otmp['obj'] = obj2;
    o['order'] = otmp; gcode["chat_out"] = o;
    return gcode;

}

// 【〜である】登録 affirmativeOrder()
//
// 「場合分け」の課題。if then else ではなく意味的パターンマッチに変更したい。
//  ただし、srules.jsと組み合わせたパターンマッチは動的な情報を使えない、
//  局所的な単一パターンマッチであり、使い勝手が悪い。
function affirmativeOrder(escode){

    var s = pickNoun(escode.s, escode); //console.log("s:", s);
    var v = pickVerb(escode.v, escode); //console.log("v:", v);
    var obj1 = pickNoun(escode.obj1, escode);
    var obj2 = pickNoun(escode.obj2, escode);
    var nfor = pickNoun(escode.for, escode);
    var nin = pickNoun(escode.in, escode);
    var gcode = {}; var o = {};

    //{ s: [ 'the', 'smoking', 'area' ], v: [ 'be' ], obj2: [],  where: { s: [ 'you' ], v: [ 'can', 'smoke' ] } }
    if (v == 'be' && obj2 == empty && escode.where != undefined){
	var otmp = {}; otmp['s'] = s; otmp['v'] = pickVerb(escode.where.v,escode);
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }

    // {s: [ 'you'], v: ['can', 'smoke'], in:['the','smoking','area']}
    if (s == 'you' && v != undefined && nin != undefined){
	var otmp = {}; otmp['s'] = nin; otmp['v'] = v;
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
}

    //{ s: [ 'the', 'bus', 'stop' ], obj2: [],  for: [ 'okazaki', 'park' ],  unprocessed: { phrase: [ 'be', 'number', '3' ] } }
    //console.log("imperative:", escode);
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
    //{ s: s: [ 'tetsuhaku' ], v: [ 'be', 'not' ], obj2: [ 'another', 'name' ], for: [ 'railway', 'museum' ] }
    if (v == 'be' && obj2 == 'another-name'){
	var otmp = {}; otmp['s'] = s; otmp['alias_of'] = nfor; 
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }
    if (v == 'be-not' && obj2 == 'another-name'){
	var otmp = {}; otmp['s'] = s; otmp['not_alias_of'] = nfor; 
	o["status"] =otmp; gcode["chat_out"] = o;
	return gcode;
    }
}

   /*
 { stype: 'there_be',
  v: [ 'be' ],
  i: 20,
  s: [ 'kick-off', 'meeting' ],
  obj2: [],
  in: [ 'the', '3rd', 'floor', 'meeting', 'room' ],
  from: [ '15', 'o\'clock' ],
  to: [ '17', 'o\'clock' ],
  on: [ '4/18' ] }
    */
    /*
      {chat_out: {reserve: {title: 'kick-off meeting',  started_at: '5/10 15:00', finished_at: '5/10 17:00',  place: '3rd meeting room', participants: null}}}
     */

function dialogLearning(escode){
    if (escode.stype == 'there_be'){
	var o = {}; var o2 = {}; var gcode = {};
	o.title = escode.s[0]+" " + escode.s[1];
	o.started_at = escode.on+" "+ escode.from[0]+":00";
	o.finished_at = escode.on+" "+ escode.to[0]+":00";
	o.place = escode.in[1] + " " + escode.in[3]+" "+escode.in[4];
	o.participants = null;	
	o2['reserve'] = o;
	gcode['chat_out'] = o2;
	contextRegister('meeting', o2);
	return gcode;
    }
    if (escode.stype == 'affirmative'){
	var o2 = contextRead('meeting');
	var gcode = {};
	o2.participants = escode.s;
	gcode['chat_out'] = o2;
	return gcode;
    }
}

function dialogInformation(escode){

    //{chat_out: {visitor: {coop: "monogocoro", name: 'tanaka', check: 'ok'}}}
    var o = {}; var o2 = {}; gcode = {};
    o.coop = escode.from[0];
    o.name = escode.obj2[0];
    o.check = 'ok';
    o2['visitor'] = o;
    gcode['chat_out'] = o2;
    return gcode;
}

function charactergen(escode){
    var gcode = {}; 
    gcode['chat_out'] = 'ack';
    return gcode;
}

module.exports = function (language, mode_flag, dialog_mode, line) {
    return interpreter(language, mode_flag, dialog_mode, line);
}
