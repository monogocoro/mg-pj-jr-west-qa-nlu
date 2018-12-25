///
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

var debug = false;
var debugC = false;
var print = false;
var sfprint = true;


// --------------------
// システムインタプリタ
// -------------------

var noEmpty = true;

var args; // for controlling generateJcode();

var chat; // for chat mode flag
function interpreter(language, mode_flag, line0) {

    // all reset for global variables in this code
    nodemarks = [];
    tokens = [];
    tokenIdList = [];
    tokenList = [];
    scode = [];
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
        line = JSON.parse(line).chat_in;
    }

    if (mode_flag == "keyboard" && language == "ja"){ //ひらがな->漢字
	//console.log("かな変換:", line);
	line = e2j_kanareplace(line);
    } else if (language == "en"){ //英語：各単語の先頭を大文字化。
	line = capitalize(line);
    } else {
	//console.log("通常:", line);
	line = line;
    }
    console.log(line);

    args = []; // 毎入力ごとに、ルール適用によって生成される$1, $2,..パラメータ値をリセットする
    
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

    // 意味トークン抽出
    generateScode();

    // 最終query生成
    if (chat == true){
	var chatcode = generateChatCode();
	console.log(chatcode);
	return chatcode;
    } else {
	var jcode = generateJcode();
	console.log(jcode);
	return jcode;
    }
}

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
	
	/* 日本語->English */ mirai = get_ja2en(text);
	mirai = mirai_correct(mirai); // 機械学習による誤変換を訂正
	mirai = preprocessing_time(mirai);
	mirai = double2single(mirai); //複文を単文に
    }
    console.log(mirai);

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
    return json;
}


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

    if (debugC) {
        for (var i in tokenList) {
            var cat = tokenList[i].content.cat;
            if (tokenList[i].content.cat == "V" && tokenList[i].content.type == "noun_mod")
                cat = tokenList[i].content.type;
            console.log(tokenList[i].content.base + "[" + cat + "]");
            var arg1 = tokenList[i].arg1;
            var arg2 = tokenList[i].arg2;
            var arg3 = tokenList[i].arg3;
            if (arg1 != undefined) console.log("          <arg1>---> ", arg1.content.base);
            if (arg2 != undefined) console.log("          <arg2>---> ", arg2.content.base);
            if (arg3 != undefined) console.log("          <arg3>---> ", arg3.content.base);
        }
    }

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
        var arg1 = tokenList[i].arg1; code["arg1"] = null;
        var arg2 = tokenList[i].arg2; code["arg2"] = null;
        var arg3 = tokenList[i].arg3; code["arg3"] = null;

        if (tokenList[i].content.pos != undefined)
            code["pos"] = tokenList[i].content.pos;

        // A cat arrived in the park. [cat arrived]の自動詞としてarrivedを分離するため。
        // 参考: 進行形 aspect = progressive, voice = active
        if (code["type"] == "noun_mod" &&
            tokenList[i].content.aspect == "none" && tokenList[i].content.voice == "passive") {
            code["cat"] = "V";
            code["arg1"] = arg2.content.base;
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
        if (print) console.log(JSON.stringify(stack[i]));
    }
    ecode = stack;
    tokenIdList = [];
    tokenList = [];
}

// --------------------------
// scode生成: 意味トークン抽出
//   generateScode();
// --------------------------

// ** 以下の説明は一部goolishに依存、一部実装に依存し古い！
// ** 正確なところは、実際のコード中のコメント参照

// ---------------
// CONJ「,」の扱い
// ---------------
// 例。彼は学校に行き、公園に行き、彼女は映画に行った。
// He went to school, went to the park, and she went to the movies.
// 最初の「,」は主語heに準じてる。
// {"cat":"CONJ","base":"-COMMA-","pos":",","arg1":"go","arg2":"go"}
// 一方、２番めの「,」は新しい主語sheの登場を示唆している。
// {"cat":"PN","base":"-COMMA-","pos":",","arg1":"and","arg2":null}

// ----------
// and の区別
// ----------
// 節を仲介するand {lexetry: "[V.decl<CONJP>V.decl]"}
// 語あるいは句を仲介するand {lexetry: "[N<CONJP>N]"}

// --------------------------------
// there 分離したい in splitEcode()
// --------------------------------
// cat = Nとして独立して分離できずphraseの中に残る場合
//    pos = RB
//    pos = EX
//    pos = DT

//
// is <something>の場合、is[N]となることがある。
// 例。
// Is KAISUKEN allowed to input three pieces at the same time?
// "Is KAISUKEN"で名詞句を作っている。
// どういう組み合わせだと名詞句になり、逆に、動詞として分離されるのか。

// ---------------------------------------
// 名詞を含む句部分の処理 in splitPhrase()
// ----------------------------------------
// (1) 冠詞を除く。厳密にはまずい。ただしgoolishがその辺、「適当」なので由とする。
// 冠詞 cat: "D"

// (2) 名詞句の前につく形容詞部分 名詞に対する制約として働く
// warm coffee
// {"cat":"ADJ","base":"warm","pos":"JJ"}
// {"cat":"N","base":"coffee","pos":"NN","arg1":null,"arg2":null,"arg3":null}

// (3) 名詞句に続いて形容詞的働きを持つもの。open nearby等
// cat = N |ADJ 名詞句の中に残る。妥当。
// cat = ADV 名詞句と独立
//     Is there a coffee shop open now?
//     open: ADV
//     now: ADV
// cat = V 動詞。妥当。

// (4)
// 名詞句に続いて、これを「形容する部分が付く」 : 制約として働く
//    形容詞
//    to <動詞>
//    which <動詞>
//    where you can <動詞>
//    that <動詞>
//    なお<動詞>の前に助動詞 auXが付くことがある
// {"cat":"N","base":"he","pos":"PRP"}
// {"cat":"N","base":"where","pos":"WRB"}
// {"cat":"N","base":"what","pos":"WP"}
// {"cat":"C","base":"to","pos":"TO"}

// (5) 名詞句が副詞的に機能するもの
// {"cat":"D","base":"this","pos":"DT","type":"noun_mod","arg1":"time","arg2":null,"arg3":null}
// {"cat":"N","base":"time","pos":"NN","arg1":null,"arg2":null,"arg3":null}
// -> "this_time"

// 数詞の扱い
//8:32
// pos == 'CD'+':'+'CD'

//2nd
// base == '-NUMBER-nd'

//No.30
// base == 'no-PERIOD-' + '-NUMBER-'

//何番線 number_noriba
// base == 'number'

//一日券
//base == '-NUMBER--day'
//base == 'one-day'

// 関数：splitEcode()
// ecodeを1件ずつみていき、次を区切り子として分割し、scode配列にスタック
// 分割単位はphraseとして扱う。
// (a) noun_modではない動詞[V]
// (b) 前置詞[P]
// (c) 副詞[P]
// (d) 冠詞[DT]
// (e) 文冒頭で名詞と扱われる
// (d) 文を区切る接続詞and

// 関数: sunit()
// この際、動詞は、aspectとvoiceでVPA, VNA, WNPに分類し、それ以外にarg1, arg2の情報を追加。
// それ以外のトークン（主としてADV, ADJ）はcatとbaseのみを取り出す。
// 数詞は数の処理を行う。

// 関数: splitPhrase()
// splitEcodeで分割された単位phraseを受け、gram:として再度分割する。
// この際、splitEcode()でうまく分割されなかったものを再度分離するのと、単語のカテゴリを追加する。
// (a) 「,」は無視
// (b) 副詞型[RB]、存在子型[EX]、冠詞型[DT]のthereは分離対象とする
// (c) 助動詞[auxV]を分離
// (d) 動詞につく前置詞[PRT]を分離
// (e) 冠詞型のWH [WDT]を分離
// (f) 受け身の動詞を分離
// (e) 名詞句をつなぐandを分離

// 関数: sunit2
// ecodeのリストを受け取り、個々の要素に関しsuitを呼び出す。

var scode = [];
var full_scode;

function generateScode() {
    
    scode = splitEcode();
    if (print) console.log("--scode---");
    if (print) console.log(printObject(scode));
    full_scode = full_flatten(scode); // used in dialog.js for analyzing the detail intention
    var s = flatten(scode);
    if (sfprint) console.log("--sfcode--");
    if (sfprint) console.log(printObject(s));
    scode = s;
}

function full_flatten(A){
    // simply delete gram: part
    // no concatenation in gram: part
    var stack = [];
    for (var o of A){
	if (o["gram"] != undefined){
	    for (var i = 0; i < (o.gram).length; i++){
		stack.push((o.gram)[i]);
	    }
	}
	else {
	    stack.push(o);
	}
    }
    return stack;
}

function flatten(A) {

    var stack = [];
    for (var o of A) {
        if (o["gram"] != undefined){
	    var nobj;
	    var r = concatenate(o.gram); 
	    nobj = r.conc;
	    //console.log("gram size:", (o.gram).length, " size:", r.size);
	    stack.push(nobj);
	    if ((o.gram).length > r.size){ // 結合対象が残っている
		var rest = (o.gram).slice(r.size, (o.gram).length);
		r = concatenate(rest);
		if (JSON.stringify(r) != "{}"){
		    nobj = r.conc;
		    stack.push(nobj);
		}
	    }
	}
        else {
	    stack.push(o);
	}
    }
    return stack;
}

function concatenate(a) {

    // 冠詞を除くのは本来好ましくない。
    // => {conc: 合成オブジェクト, size: 使用したオブジェクト数}
    var r = {};
    var nobj = {};
    // [{"N":"number"},{"ADJ":"32"}] -> {number: 32}
    if (getvalue(a[0]) == "number" && getkey(a[1]) == "ADJ"){
	nobj["number"] = getvalue(a[1]);
	r["conc"] = nobj, r["size"] = 2;
	return r;
    }

    // [{"N":"time"},{"ADJ":"0622","pos":"CD"}] -> {time: 0622}
    if (getvalue(a[0]) == "time" && getkey(a[1]) == "ADJ"){
	nobj["time"] = getvalue(a[1]);
	r["conc"] = nobj; r["size"] = 2;
	return r;
    }

    // [{"N":"platform","pos":"NN"},{"ADJ":"30"}] -> {number: 30}
    if (getvalue(a[0]) == "platform" && getkey(a[1]) == "ADJ"){
	nobj["number"] = getvalue(a[1]);
	r["conc"] = nobj; r["size"] = 2;
	return r;
    }

    // [{"ADJ":"2"},{"N":"platform","pos":"NN"}] -> {number: 2}
    if (getvalue(a[1]) == "platform" && getkey(a[0]) == "ADJ"){
	nobj["number"] = getvalue(a[0]);
	r["conc"] = nobj; r["size"] = 2;
	return r;
    }
    
    // [{"N":"biwako"},{"N":"express"}] -> {N: biwako_express}
    // {"N":"it","pos":"PRP"}
    // {"N":"hot","pos":"VB"}

    // it's a fine art school.
    var i = 0;
    if (a[i].pos ==  "DT" || a[i].pos == "PRPnodemark") i++; // 'a' or 'the'
    var noun = getvalue(a[i]);

    i++;
    while(i < a.length){
	//noun = noun +  "_" + getvalue(a[i]);
	noun = noun +  "-" + getvalue(a[i]);
    	i++;
    }
    noun = delete_station(noun);
    noun = pick_station(noun);
    nobj["N"] = noun;
    r["conc"] = nobj; r["size"] = i;
    return r;
}

function delete_station(s){
    // tokyo_station => tokyo
    if (s == undefined) return s;
    var split = s.split("_");
    if (split.length == 2 && split[1]=="station"){
	return split[0];
    }
    else{
	return s;
    }
}

function pick_station(s){
    if (s == undefined) return s;
    // train-osaka => osaka
    if (s.indexOf('train-') === 0){
	return s.replace('train-','');
    } else {
	return s
    }
}

function splitEcode() {
    
    // ecodeを動詞(V)、前置詞(P)、副詞(ADV)、節間andを分離
    var ex = ecode; //miraiの出力に対しecodeは複数行からなる
    var gx = tokenSplit(mirai); //各ecodeに対応するmiraiの要素（単語）
    var i = 0;
    var phrase = [];  // ecodeを分割しscode用に再構成する
    var gphrase = []; // 対応するgxの分割・再構成用
    while (i < ex.length) {
	var exi = ex[i];
	var gxi = gx[i];
	exi = comparative_degree(exi);
        phrase.push(exi);
        gphrase.push(gxi);
        if ((exi.cat == "V" && exi.type != "noun_mod") ||
            exi.cat == "P" ||
	    //(exi.cat == "N" && exi.base == "tomorrow") || // tomorrowは名詞となる。
	    (exi.cat == "N" && exi.base == "station") ||  // stationの接続を分離
            exi.cat == "ADV" ||
	    (exi.cat == "ADJ" && exi.pos != "CD") ||
	    (exi.pos == "WDT" && exi.base != "what")|| // that ..., which ... ,what_timeを除く
	    exi.pos == "TO" || // a place to eat
            //exi.pos == "DT" ||
            (i == 0 && exi.base == "is") ||
            (exi.cat == "CONJ" && isANDV(exi.lexetry))) {
	    
            var token = phrase.pop();
            var gtoken = gphrase.pop();
            //console.log("splitPhrase1:", phrase);
            splitPhrase(phrase, gphrase);
            scode.push(sunit(token, gxi));
            phrase = []; gphrase = [];
        } else if (i == ex.length - 1) { //分割対象が無い場合
            //console.log("splitPhrase2:", phrase);
            splitPhrase(phrase, gphrase);
        } else {
	    //console.log("else:", exi);
	}
	//console.log("i:", i, " exi:", exi);
        i++;
    }
    return scode;
}

function comparative_degree(obj){
    // scode生成前に変換する。
    if (obj.base == "nearby") {
	obj.base = "near"; obj.cat = "ADJ"; return obj;
    }
    if (obj.cat == "N" && obj.base == "open"){
	obj.cat = "ADJ"; return obj;
    }
    if (!(obj.cat == "ADJ" && obj.pos == "JJS")) return obj;
    switch (obj.base){
    case "near": obj.base = "nearest"; return obj;
    default: return obj;
    }
}

function tokenSplit(s0) {

    //miraiの出力(英文）をecode各行に対応するように各単語単位に分割する。
    //console.log(not_tokenSplit("How far is it from Tokyo to Kyoto?"));
    //console.log(not_tokenSplit("Isn't the Haruka that leaves at 6:22 the platform 30?"));
    var s = not_tokenSplit(s0);
    s = s.replace(':', ' &cln ');
    s = s.replace("'d", ' would');
    s = s.replace("'s", " &s ");
    s = s.replace(",", " ,");
    s = s.replace(/\.$|\?$/, '');
    var a = s.split(' ');
    return a.filter(function (e) { return e !== ""; });
}

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

function splitPhrase(phrase, gphrase) {

    // 引数
    //   phrase: splitEcode()が生成したもの
    //   gphrase: mirai出力を元としてphraseに一対一に対応したもの

    // ここではphraseをさらに小さく分解する
    // (a)PN型の-COMMA-に関して。後続するandが節の分離をカバーしているのでここでは単純に削除する。
    // (b)副詞(RB)／存在(EX)／冠詞(DT)型thereの分離
    // (c)助動詞(auxV)の分離
    // (d)前置詞(prt)の分離
    // (e)従属節(SC)
    //     従属接続詞subordinate conjunction: becase, as, as if, so that, ..
    //     関係代名詞 relatvie pronoun: that, what, which, who
    // (f) Wh限定子(WDT) which book do you like better?
    // (g) 受動形 形容詞的使用を想定
    // (h) 複文型AND
    
    var i = 0;
    var gram = [];
    var ggram = [];

    var sunit2_tmp = {gram:[]}; 
    
    while (i < phrase.length) {
	//console.log("i:", i, " phrase[i]:", phrase[i]);
        gram.push(phrase[i]);
        ggram.push(gphrase[i]);

	//console.log("gram:", gram);
        if (phrase[i].cat == "PN" && phrase[i].base == "-COMMA-") {
            i++; //スルー
        } else if (
	    (phrase[i].base == "there" &&
             (phrase[i].pos == "RB" || phrase[i].pos == "EX" || phrase[i].pos == "DT")) ||
		phrase[i].cat == "auxV" ||
		phrase[i].cat == "PRT" ||
		phrase[i].cat == "SC" ||
		phrase[i].cat == "WDT" ||
		phrase[i].pos == "PRP" || // Isn't [it.pos == PRP] hot. should be separated.
		(phrase[i].cat == "V" && phrase[i].voice == "passive") ||
		(phrase[i].cat == "CONJ" && isANDN(phrase[i].lexetry))) {
            var token = gram.pop();
            var gtoken = ggram.pop();
            if (JSON.stringify(gram) != "[]") {
                //console.log("scode.push1:", sunit2(gram, ggram));
                scode.push(sunit2(gram, ggram));
            }
            //console.log(phrase[i].cat, "", token.base);
            var a = {}; a[phrase[i].cat] = token.base;
	    //console.log("scode.push2:", a);
            scode.push(a);
            gram = [];
            ggram = [];
        } else if (i == phrase.length - 1 || gram.length > 1) {

	    //原因不明。部分列の生成が連続して起きる。
	    //{ gram: [ { D: 'a', pos: 'DT' }, { N: 'guest', pos: 'NN' } ] }
	    //{ gram: [ { D: 'a', pos: 'DT' }, { N: 'guest', pos: 'NN' }, { N: 'house', pos: 'NN' } ] }

	    //以下対処--->
	    var s2 = sunit2(gram, ggram);
	    if (partial_matchQ((sunit2_tmp.gram), (s2.gram))){
		sunit2_tmp = s2;
		//console.log("pharase:", phrase, " gram:", gram);
		if (phrase[phrase.length-1] == gram[gram.length-1] ||
		    ((phrase[phrase.length-1].base) == "-COMMA-" &&  //, but 等の場合
		     phrase[phrase.length-2] == gram[gram.length-1])){
		    //phraseの最後とaggregateされたgramの最後の一致で、aggregateの最終を判定。
		    scode.push(sunit2_tmp);
		}
	    }else {
		// only for the bug case:
		// 弁当屋は何時から開くのか。
		// What time does the bento shop open?
		//console.log("else s2:", s2);
		scode.push(s2);
	    }
	    //-------<
        } 
        i++;
    }
}


function partial_matchQ(a1, a2){ // 先頭から一致検査

    // a1.length < a2.length を仮定

    //var o0 = {"gram":[{}]};
    //var o1 = {"gram":[{"N":"time","pos":"NN"},{"ADJ":"0622"}]};
    //var o2 = {"gram":[{"N":"time","pos":"NN"},{"ADJ":"0622"},{"N":"platform","pos":"NN"}]};
    //var o3 = {"gram":[{"N":"time","pos":"NN"},{"ADJ":"0622"},{"N":"platform","pos":"NN"},{"ADJ":"30"}]};
    //console.log(partial_matchQ(o0.gram, o1.gram));

    if (a1.legnth == 0) return true;
    
    var i = 0;
    var flag = true; //一致フラグ
    while (i < a1.length){
	if (JSON.stringify(a1[i]) != JSON.stringify(a2[i])){
	    flag = false;
	    break;
	}
	i++;
    }
    if (flag && i < a2.length) return true;
    else return false;
}




// ---------
// sunit
// sunit2
// sunit2pos
// ---------

function sunit(token, gx) {

    // 引数
    //   token: ecode中トークンに対し、
    //   (a) 動詞に対しては、タイプを追加。かつ、arg1, arg2を決定
    //   (b) 副詞(ADV)はそのまま
    //   (c) 形容詞(ADJ)はpos(形態情報)を追加
    //   (d) その他。complementizer不定詞ではarg1を追加
    var a = {};
    if (token.cat == "V") {
        var key;
        if (token.aspect == "progressive" && token.voice == "active") key = "VPA";
        else if (token.aspect == "none" && token.voice == "active") key = "VNA";
        else if (token.aspect == "none" && token.voice == "passive") key = "VNP";
        else key = "V";
        a[key] = token.base;
        a["arg1"] = token.arg1;
        a["arg2"] = token.arg2;
    } else if (token.cat == "ADV") {
        a[token.cat] = token.base;
        a["pos"] = token.pos;
    } else if (token.cat == "ADJ") {
        a[token.cat] = token.base;
       a["pos"] = token.pos;
    }
    else {
        a[token.cat] = token.base;
	a["pos"] = token.pos;
	if (token.cat == "C") a["arg1"] = token.arg1;
    }
    return a;
}

function sunit2(gram, ggram) {

    // splitPhraseで分割された対象gram:タグでまとめる。
    var g = {};
    var a = [];
    for (var i = 0; i < gram.length; i++) {
        a.push(sunit(gram[i]));
    };
    a = sunit2post(a, ggram);
    //g["gram"] = tonoun(a);
    g["gram"] = a;
    return g;
}

function sunit2post(tokenList, ggram) { // 主として数詞処理
    
    // sgram: gramがsuit2で処理された後の値

    // -NUMBER- => 当該数字が入る => 32
    // -NUMBER-nd => 当該数字が入る => 32nd
    // -COLON- => 6_COLON_32
    // 's => &s に変換

    var tkn = [];
    for (var i = 0; i < tokenList.length; i++) {
        var token = tokenList[i];
        if (token.N == "no-PERIOD-") continue;
        if (token.N == "-NUMBER-" || token.N == "-NUMBER-nd") {
            var o = {};
            o["N"] = ggram[i];
            tkn.push(o);
        } else if (token.ADJ == "-NUMBER-" || token.ADJ == "-NUMBER-nd" || token.ADJ == "-YEAR-") {
            var o = {};
            //o["ADJ"] = number(ggram[i]);
	    o["ADJ"] = ggram[i];
            tkn.push(o);
        } else if (token.N == "-NUMBER--day") {
            var o = {};
            o["N"] = ggram[i];
            tkn.push(o);
        } else if (token.ADJ == "-NUMBER--day") {
            var o = {};
            o["ADJ"] = ggram[i];
            tkn.push(o);
        } else if (token.PN == "-COLON-") {
            var o = {};
            o["N"] = ggram[i];
            tkn.push(o);
        } else if (token.D == "\'s") {
            var o = {};
            o["D"] = "&s";
            tkn.push(o);
        }
        else {
            var o = token;
            for (var key in token) { // adj: three
                if (key == "ADJ") {
                    //o["ADJ"] = number(token[key]);
		    o["ADJ"] = token[key];
                }
            }
            tkn.push(o);
        }
    }
    return tkn;
}

function isANDV(entry) { // i go and i drink
    
    if (entry == "[V.decl<CONJP>V.decl]") return true;
    else return false;
}

function isANDN(entry) { // book and apple
    
    if (entry == "[N<CONJP>N]") return true;
    else return false;
}

// ライブラリ
// getkey / getvalue / printObject

function getkey(o) {
    
    return (_.keys(o)[0]);
    //return (Object.keys(o))[0];
}

function getvalue(o) {
    
    return (_.values(o)[0]);
    //return (Object.values(o))[0];
}

function printObject(objs) {
    
    for (var i = 0; i < objs.length; i++) {
        console.log(JSON.stringify(
                objs[i],
                function (k, v) {
                    if (v === null) return undefined // 表示だけの問題。問題なし。
                    return v
                }, null, ' '))
    }

}

// --------------------------
// JCODE生成 (scode -> jcode)
// --------------------------

//
// --- 「会話」における意図抽出の難しさ
//    (a) 形式的で長文の方が細かい情報をとりやすい
//    (b) 一方、抽出ルールが細かすぎると、表現乱れに対応できなくなる
//    (c) 結局、このバランスをうまく吸収する、たぶんオンロジー辞書なのか。
//    (d) しかし、本システムを発展させるには(a)部分は簡略化したくない。
//

// --- 動詞オントロジー
//     たとえば isVerb + isParticle + isNoun 各述語が対象をargsとは別に
//     一旦保存。
//    ついで、動詞オントロジーを引き、当該日本語を生成
//     この場合、他の副詞、形容詞等に関して、どうするか。
//     得られた情報からどう、JCODEを再構成するか。
//     しかし、このアプローチ、非常に有望。過去に試みた内容の集大成として使える！

/*
*_dic 主として日本語固有名詞↔英語変換用、ただし、単独で発音された場合、queryタイプを推定するのに利用

述語関数 
例　isLINE 線
　　isTRAIN(isTIME) 
　　vEXIST
　　adjDISTANCE　
　　advDATE
パターン変数 $　述語タイプを含む
述語関数
　課題 1.　引数
　課題 2.　オプショナル
パターン関数　$変数を含む
　smoke room 喫煙室
*/

const srules = require(__dirname+'/srules.js');
const scoderules = srules.make();
function generateJcode() {
    
    if (print) console.log("--jcode---");
    // interprete scode then generate jcode

    var jcode = JSON.stringify({ queryJDB: {fail: ''}});
    var ri = 0;
    //scode = flatten(scode);　ここを削除
    var rule, pattern;
    while (ri < scoderules.length) {
        // ruleappl破壊されるのを防ぐ。
        // 原因不明。要デバッグ！
        // 現状はルールすべてをコピーするので、ルール数に応じたオーバヘッドが生じる。
        rule = deepCopy(scoderules[ri].rule);
        if (ruleapply(scode, rule)) {
	    console.log("scode:",scode," rule:", rule);
	    if (scoderules[ri].ptn == undefined) {
		console.log("** rule pattern syntax error:",scoderules[ri])
	    };
            pattern = JSON.parse(JSON.stringify(scoderules[ri].ptn));
            jcode = JSON.stringify(pattern, replacer);
            break;
        } else {
            //console.log("fail");
        };
        ri++;
    }
    //finaling
    //console.log("jcode:", jcode);
    jcode = arg_replace(jcode);
    //console.log("jcode, arg replaced:", jcode)
    jcode = e2j(jcode);
    scode = []; //global variable
    return jcode;
}

const default_station = "京都";
const default_station_en = "kyoto";
function e2j(query){
    return (JSON.stringify(JSON.parse(query), function(key, value){
        if (key == "name" || key == "from" || key == "to" || key == "to_place" || key == "station" || key == "brand" || key == "location" || key == "at_stop" || key == "way") {
	    if (value == "what") return value;
	    //console.log("value:",value, " e2j:", e2j_replace(value));
	    if (value == default_station){
		return (default_station_en+"#"+e2j_replace(value));
	    }
	    else{
		return (value+"#"+e2j_replace(value));
	    }
	}
        else{
	    //console.log("e2j: return ", value);
	    return value;
	}
    }))
}

function typeOf(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
}
function isArray(obj) {
    return typeOf(obj) == 'array';
}

function ruleapply(scode, rule){
    if (isArray(rule[0]) != 'array') return ruleapply0(scode, rule);
    else {
	for (var i = 0; i < rule.length; i++){
	    if (ruleapply0(scode, rule[i])) return true;
	};
	return false;
    }
}

function ruleapply0(scode, rule) {

    // 日本語->英語->(部分的に)日本語に変換する「タイミング」について
    // 2つの重要なポイントがある。
    // (a) 日本語(普通名詞）を英語にしたとき複数の単語に落ちる。
    // (b) 一方、複数の英語表現が1つの日本語になるときもある。
    // 多言語対応、たとえば英語ｰ>英語であっても、この問題は起きる。

    // この問題は、jcode生成時に使用するsrulesにも影響する。
    //     解：(1)gram化時、たとえばsmoke[base name] room をsmoke_roomに変換する
    //         (2)ルールパターンにはsmoke_roomを使用する
    //         (3)パターン変換時、smoke_roomを喫煙所に変換する
    // 　　つまり、ここでgetjword()をここで使用せず jrules.js に移動する。
    
    // gram:処理
    // (a) 名詞群を1つ
    // (b) 動詞+名詞を名詞
    // (c) 形容詞+名詞 | 名詞+形容詞
    // (d) 副詞

    // * scode中、動詞+名詞の組み合わせに対するアルゴリズム変更の予定
    // rule: srules.jsのすべてのルールを試す
    var i = 0;
    while (i < scode.length) {
       //console.log("scode:", scode[i], " rule:", rule);
        var sflag = false; var fflag = false;
        if (JSON.stringify(rule) != "[]" && typeof rule[0] == "string") {
            if (getvalue(scode[i]) == rule[0]) {
                rule.shift(); // next element of the rule
                i++; sflag = true;
            }
        }
        if (JSON.stringify(rule) != "[]" && typeof rule[0] == "function") {
	    var fnameprex = (rule[0].name).substring(0,2); //check "is"FUNCTION
            if (rule[0](scode[i])) {
		if(fnameprex == "is") args.push(getvalue(scode[i]));
                //console.log("i:", i, " args1:", args);
                rule.shift();
                i++; fflag = true;
            }
        }
        if (!(sflag || fflag)) i++;
    }
    //console.log("i:", i, " args2:", args);
    if (JSON.stringify(rule) == "[]") {
	//console.log("args:", args);
        //args = args.reverse();
        return true;
    }
    else {
        args = []; //失敗したのでargsをクリアする
        return false;
    }
}


function callback_func(){
    
    return "callback_func";
}

function replacer(key, value) {
    
    // ルール内の変数をargs（ルール内述語に対応したscodeをスタック）に保存
    // ついで、この機能を使い、ルール内変数$*をargsの中身で置き換える。
    switch (value) {
        //今の状態はルール上の変数を最大6までとしている。
        //もちろんこれを増やすことは可能。
    case '$scode': return full_scode;
    case '$callbackfunc_$1': return callback_func();
    case '$1': return args[0];
    case '$2': return args[1];
    case '$3': return args[2];
    case '$4': return args[3];
    case '$5': return args[4];
    case '$6': return args[5];
    }
    return value;
}

function arg_replace(sobj){
    // jcode中に関数を含めた場合、スコープの関係で$変数の置換が失敗する。
    // したがって合成後の文字列に関し、$変数をargsの中身で置き換える。
    var ss = sobj;
    for (var i = 0; i < args.length; i++){
	ss = ss.replace("$"+(i+1), args[i]);
    }
    return ss;
}

function deepCopy(obj) {

    // srules.js内の各ルール記述が変更されるのを防ぐ
    // 現状は対策が見えないので、ルール自体を毎回複製して使用している
    // ref. https://st40.xyz/one-run/article/338/
    var copy;

    if (null == obj || "object" != typeof obj) return obj;

    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
    } else if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy.push(deepCopy(obj[i]));
        }
    } else if (obj instanceof Object) {
        copy = Object.create(obj);
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}

/*

var chat; 
var intent;
var context;
var focus; 

input: {chat_in: "ログ解析を開始してください。"} -> start-log-analysis (scodeレベル)
   var chat_content = "start('log-analysis')"; 
     *この辺がポイント。述語関数形式に変換。
     *本来 startは動詞。しかしenjuは名詞として扱う。なので、ここは例外的にstartを分離。
     *たとえば「ログ解析を終了」はfinish<VNA> log-analysisとなる。
　　 *なので "finish('log-analysis')"とできる。
   chat = true;
   context = chat_content; //本セッションが終わるまでの保存
   in the place between scode and jcode
      if chat == true 
      then chat_anaylysis(chat_content); // "start('log-analysis')"

   function chat_analysis(content)
     intent = 'start';

     eval(content); // start('log-analysis')
     in start(..)関数内
       case of 'log-analysis'
         (a-1) var log = get_log_summary();
         (a-2) var not_answered = "UnionPayは使える。"; // kind_no 2
                * notpoper_answer: kind_no 4
                * unsatisfied_answer: kind_no 3
         (b-1) 文生成
           var confirmed = "はい";   // phrase_confirmed(intent, context);
           var answer = "お客様から" + not_answered + という問い合わせがあり、答えられませんでした。"; 
               // phrase_answer(intent, context, log_ans(kind_no, not_answer))
           var reply = confirm+answer;
         (b-2) chat_output生成
           {chat_out: {chat_reply:{replyJDB: reply}, chat_edit: {}}

input: {chat_in: "UnionPayはクレジットカードです。"} 
       -> 'unionpay' + 'be' + 'credit-card'  : A is B  AはBのインスタンス。
          「太郎は犬です。」はあり。「犬は太郎です。」は普通ない。
   chat_content = "is_a('unionpay', 'credit-card')";
   focus = 'uniopay';
   chat = true;
 
   in the place between scode and jcode
      if chat == true 
      then chat_anaylysis(chat_content); // "is_a('unionpay', 'credit-card')"

   function chat_analysis(content)
     intent = 'is_a'

     eval(content);   // is_a('unionpay', 'credit-card')
     in is_a(..)関数内
       仮定： 'credit-card'はデータベース内のクラスの1つ
              'unionpay'はそのレコードの1つ。
　　　 var dbedit = {};
       dbedit['class] = 'credit-card'; 
       dbedit['add_instance'] = 'unionpay';
       //文生成
       var confirmed = "わかりました。"; // phrase_confirmed(intent, context);
       var answer = "どこで使えるのでしょうか。";
           // phrase_answer(intent, context, db_ans(chat_content);
           // is_a, credit_card, .. => どこで+使える
       var reply = confirm+answer;

       //chat_output生成
       {chat_out: {chat_reply:{replyJDB: reply}, chat_edit: dbedit}} 
       　//ただし、現時点では本件無視される。unionpayのレコードは予め登録済みとする。

input: {chat_in: "セブン銀行で使えます。"}
     -> 'can'+'use'+'it'+'at'+'seven-bank'
     'it'が'uniopay'を参照する(focus);
     chat_content = "can_use_at('unionpay', 'seven-bank')";
     chat_content = "add_link('unionpay', 'seven-bank')"; //verb ontology for database
     
  function chat_analysis(content)
    intent = 'can_use_at';

    eval(content); can_use_at('unionpay', 'seven-bank');
    if can_use_at(...)関数内
　　   var dbedit = {};
       dbedit['class'] = 'credit-card':
       dbedit['instance'] = 'unionpay';
       dbedit['add_link'] = 'seven-bank';

    conifrm = ""; // phrase_confirmed(intent, context);
    answer = "UnionPayをセブン銀行に紐づけます。"; 
       // phrase_answer(intent, context, db_ans(chat_content));
    reply = confirm +answer
   
    //chat_output生成
   {chat_out: {replyJDB: reply}, chat_edit: dbedit }}

input: {chat_in: "よろしくお願いします。"}
   -> 'thank'+'you'
   reset session;
   {chat_out: {replyJDB: 'session_end'}, chat_edit: {}}

------

E:ログ解析を開始してください。 
A:はい。お客様から「コインロッカーの場所。」という問い合わせがあり、答えること
はできたのですが、「大きなサイズのカバンが入るコインロッカーを知りたい。」には答
えることが出来ませんでした。 
E：大きなサイズのコインロッカーは地下中央口横にあります。（注：〇〇には実際の名称を使
用）
The large size coin lockers are next to the central ticket gate.
--sfcode--
{}
{"ADJ":"large","pos":"JJ"}
{"N":"size-coin-locker"}
{"VNA":"be","arg1":"locker","arg2":"next"}
{"ADJ":"next","pos":"JJ"}
{"P":"to","pos":"TO"}
{}
{"ADJ":"central","pos":"JJ"}
{"N":"ticket-gate"}
undefined
scode: [ { N: undefined },
  { ADJ: 'large', pos: 'JJ' },
  { N: 'size-coin-locker' },
  { VNA: 'be', arg1: 'locker', arg2: 'next' },
  { ADJ: 'next', pos: 'JJ' },
  { P: 'to', pos: 'TO' },
  { N: undefined },
  { ADJ: 'central', pos: 'JJ' },
  { N: 'ticket-gate' } ]  rule: []

A：ありがとうございます。私はサイズに関する情報を持っていません。情報の追加を
お願いします。 
E：了解しました。
⇒どこかのタイイングで、【データベース編集画面】開く。
「コインロッカー」データベースにサイズを登録 


A：よろしくお願いします。

⇒データベースキーsizeおよび大きさの種類 
large/middle/smallに関し、AI
知らない前提。それを言葉で教えることもできるが。。。保留。
*/       

/*
input: {chat_in: "よろしくお願いします。"}
   -> 'thank'+'you'
   reset session;
   {chat_out: {replyJDB: 'session_end'}, chat_edit: {}}

*/

var intent;
var context;
var reference;
var dbedit;

function generateChatCode(){

    var chat_content = contentAnalysis(scode); 
    context = chat_content;
    console.log("chat_content:", chat_content);

    var confirmed = generateConfirm(intent, context);
    var answer = eval(chat_content);
    var reply = confirmed+answer;
    var chatcode = JSON.stringify({chat_out: {chat_reply:{replyJDB: reply}, chat_edit: dbedit}});
    return chatcode;
}

function contentAnalysis(code){

    var pred = "false";
    var residuals;
    residuals = partialMatch(["start-log-analysis"],code);
    if (residuals != false){
	intent = "start";
	pred = "start('log-analysis')";
	return pred;
    }

    residuals = partialMatch(["be","located","next","to"],code);
    if (residuals != false){
	intent = "located_next_to";
	pred = "located_next_to('"+rc(residuals,0)+"','"+rc(residuals,1)+"')";
	return pred;
    }

    residuals = partialMatch(["can", "use", "it", "at"], code);
    if (residuals != false){
	intent = "can_use_at";
	pred = "can_use_at('"+reference+"','"+rc(residuals,1)+"')";
	return pred;
    }

    residuals = partialMatch(["register", "database"], code);
    if (residuals != false){
	intent = "registert";
	pred = "register('database')"; //本来であれば「どの」データベースか指定する必要あり。
	return pred;
    }

    residuals = partialMatch(["under", "construction"], code);
    if (residuals != false){
	intent = "under_construction";
	pred = "under_construction('toilet')"; //どのトイレであるか指定する必要あり。
	return pred;
    }

    residuals = partialMatch(["be"],code); // A is B
    if (residuals != false && residuals.length == 2){
	intent = "is_a";
	pred = "is_a('"+rc(residuals,0)+"','"+rc(residuals,1)+"')";
	reference = rc(residuals, 0);
	return pred;
    }

    residuals = partialMatch(["thank", "you"], code);
    if (residuals != false){
	intent = "thank_you";
	pred = "thank_you()";
	return pred;
    }

    return pred;
}

function generateConfirm(intent, context){
    var ans = "";
    switch(intent){
    case 'start': ans = "はい。"; break;
    case 'is_a': ans = "わかりました。"; break;
    case 'can_use_at': ans = ""; break;
    case 'thank_you': ans = "どういたしまして。"; break;
    default: null;
    }
    return ans;
}

var log_session = 0;
function start(command){
    console.log("start:", command);
    switch(command){
    case 'log-analysis':
	log_session = log_session + 1;
	var log = JSON.parse(get_session_summary(log_session));
	dbedit = {};
	//console.log(log);
	break;
    default:
	null;
    }
    // ログ解析
    var r;
    switch(log_session){
    case 1:
	r = "お客様から" + "「UnionPayが使えない。」" + "という問い合わせがあり、答えられませんでした。";
	break;
    case 2:
	r = "お客様から" + "「コインロッカーの場所。」" + "という問い合わせがあり、答えることはできたのですが、"+"「大きなサイズのカバンが入るコインロッカーを知りたい。」" + "には答えることが出来ませんでした。";
	break;
    case 3:
	r = "お客様から" + "「東寺の紅葉ライトアップに行きたい。」" + "という問い合わせがあり、答えられませんでした。";
	break;
    case 4:
	r = "お客様から" + "「一番近いトレイはどこ。」" + "という問い合わせがあり、中央改札口横トイレを案内しました。";
	log_session = 0; //demo scenario reset
	break;
    }
    return r;
}

function can_use_at(obj, place){
    dbedit = {};
    dbedit['class'] = 'credit-card';
    dbedit['record'] = 'unionpay';
    dbedit['add_link'] = 'seven-bank';

    var r = "UnionPayをセブン銀行に紐づけます。"; 
    return r;
}

function located_next_to(obj, place){
    dbedit = {};
    var r = "私はサイズに関する情報を持っていません。情報の追加をお願いします。";
    return r;
}

function register(db){
    dbedit = {};
    var r = "よろしくお願いします。";
    return r;
}

function under_construction(obj){
    dbedit = {};
    dbedit['class'] = 'rest-room';
    dbedit['record'] = '5c219604073ef32fc70a2d5f'; //中央改札口横トイレID
    dbedit['change_status'] = 'under_construction';
    
    var r = "わかりました。中央改札口横トイレを工事中に設定します。";
    return r;
}

function is_a(A, B){
    dbedit = {};
    dbedit['class'] = A;
    dbedit['add_record'] = B;
    var r = "";
    return r;
}

function thank_you(){
    dbedit = {};
    return "";
}

// get_session_summary
function get_session_summary(nth){
    var url = 'https://preprocessor.monogocoro.ai/session_summaries/show/'+nth;
    var request = require('sync-request');
    var res = request('GET', url);
    return res.getBody('utf8');
}

// rule-based partial matching and gain residuals
function codePartialMatch(code, rule0){

    var rule = JSON.parse(rule0);
    var result = {};
    var token_list = [];
    var i = 0;
    while (i < code.length){
	if (getvalue(code[i]) == rule[0]){
	    token_list.push([code[i]]);
	    rule.shift();
	} else {
	    token_list.push(code[i]);
	}
	i++;
    }
    if (JSON.stringify(rule) == "[]"){
	result['matched'] = true;
	result['residuals'] = extractObject(token_list);	
    }
    else{
	result['matched'] = false;
	result['residuals'] = [];
    }
    return result;
}

function extractObject(list){
    
    var extract = [];
    var i = 0;
    while(i < list.length){
	while(i < list.length && isArray(list[i])) i++;
	var a = []; var start = i;
	while(i < list.length && !(isArray(list[i]))){
	    a.push(list[i]);
	    i++;
	};
	var obj = {}; obj['start'] = start; obj['content'] = a;
	extract.push(obj);
    };
    return extract;
}

function rc(res, i){
    // residual_content
    var c = res[i].content;
    var content = getvalue(c[0]);
    var i = 1;
    while (i < c.length){
	content = content + '_' + getvalue(c[i]);
	i++;
    }
    return content;
}

function partialMatch(rule, code){
    var result = codePartialMatch(code,JSON.stringify(rule));
    if (result.matched) return result.residuals;
    else return false;
}

/*
function applyRule(code){
    
    var i = 0;
    var result;
    while(i < rules.length){
	// JSON.stringify for protecting the destruction of rules
	result = codePartialMatch(code,JSON.stringify(rules[i])); 
	if (result.matched) return result;
	i++;
    }
    return {};
}
*/

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
