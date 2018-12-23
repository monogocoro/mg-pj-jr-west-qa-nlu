'use strict';
//https://qiita.com/daikiojm/items/28be6d7c87db6ea7c74b
//https://www.gesource.jp/weblog/?p=7662
//import * as csv from "csv";
//https://photo-tea.com/p/17/nodejs-write-excel-tsv-csv/ 文字コード変換
var _ = require('lodash');
const fs = require('fs');
const path = require('path');
const csvSync = require('csv-parse/lib/sync'); // requiring sync module

/* -- input.csv
hozugawa-kudari, 保津川下り
hozu-gawa-kudari, 保津川下り
hozu-river-rafting, 保津川下り
kyoto-international-manga-museum, 京都国際マンガミュージアム
international-manga-museum, 京都国際マンガミュージアム
manga-museum, 京都国際マンガミュージアム
sinoyamaguchi, 篠山口
*/

function openCSV_in(file){
    let data = fs.readFileSync(file);
    return csvSync(data); 
}

function openCSV_out(file, buf){
    let dist = path.join( process.env.PWD || process.cwd(), file);
    fs.writeFileSync( dist, "" );
    let fd = fs.openSync( dist, "w" );
    fs.write( fd, buf, 0, buf.length, (err, written, buffer) => {
	if (err){
	    throw err
	}
	else {
	    console.log("ファイルが正常に書き出されました")
	}
    })
}

function sortWithLength(S){
    return S.sort(function(a, b) {return b.length - a.length;});
}

function makeCSVstring(A, CR){
    // CR : 改行 '\n', コンマ ',' 
    // 二次元配列を仮定
    var s = "";
    for (var i = 0; i < A.length; i++){
	s = s + A[i][0];
	for (var j = 1; j < A[0].length; j++){
	    s = s + ',' + A[i][j];
	}
	if (!(CR == ',' && i == A.length-1)) s = s + CR;
    }
    return s;
}

function makeCSVList(csv){
    var A = [];
    for (var i = 0; i < csv.length; i++){
	A.push(csv[i][0]);
    }
    A = sortWithLength(A);
    var s = "'"+A[0]+"'"+",";
    for (var i = 1; i < A.length-1; i++){
	s = s + "'"+A[i]+"'"+","
    }
    s = s + "'"+A[i]+"'";
    return s;
}

function makeCSVLine(csv){
    var A = [];
    for (var i = 0; i < csv.length; i++){
	A.push(csv[i][0]);
    }
    A = sortWithLength(A);
    var s = "";
    for (var i = 0; i < A.length; i++){
	s = s + A[i] + '\n';
    }
    return s;
}

    
function mergeCSV(csv1, csv2){
    // 3列 [英語名] [和名] [ひらがな]を仮定

    //console.log("csv1:", csv1[0]);
    //console.log("csv2:", csv2[0]);
    var u1 = [];
    for (var i = 0; i < csv1.length; i++){
	u1.push(csv1[i][0]+"+"+csv1[i][1]+"+"+csv1[i][2]);
    }
    var u2 = [];
    for (var i = 0; i < csv2.length; i++){
	u2.push(csv2[i][0]+"+"+csv2[i][1]+"+"+csv2[i][2]);
    }
    var u = _.union(u1, u2);
    u = sortWithLength(u);
    //console.log(u);
    var A = [];
    for (var i = 0; i < u.length; i++){
	var a = [];
	//console.log("u[i]:", u[i]);
	var split = u[i].split("+");
	//console.log("split:", split);
	a.push(split[0]); a.push(split[1]); a.push(split[2]);
	A.push(a);
    }
    return A;
}

function japaneseList(csv){
    var jaA = [];
    for (var i = 0; i < csv.length; i++){
	jaA.push(csv[i][1]);
    }
    jaA = _.union(jaA);
    jaA = sortWithLength(jaA);
    //
    var s = "module.exports = {\nmake: function () {\nreturn[\n";
    for (var i = 0; i < jaA.length; i++){
	s = s + "'"+jaA[i] + "'," + '\n';
    }
    s = s + "]}}";
    return s;
}

function l2u(csv){
    //受け取ったcsvファイルの1列目を大文字化したものを2列名に配した
    var A1 = [];
    for (var i = 0; i < csv.length; i++){
	A1.push(csv[i][0]);
    }
    A1 = _.union(A1); A1 = sortWithLength(A1);

    var A = [];
    for (var i = 0; i < A1.length; i++){
	var a = [];
	a[0] = A1[i]; a[1] = A1[i].toUpperCase();
	A.push(a);
    }
    return A;
}

function irekae(csv){
    // 1列目と2列目を入れ替える
    var A = [];
    for (var i = 0; i < csv.length; i++){
	var a = [];
	
	a[0] = csv[i][1]; a[1] = (csv[i][0])
	A.push(a);
    }
    return A;
}

function irekae3(csv){
    // 1列目と2列目を入れ替える.3列目あり
    var A = [];
    for (var i = 0; i < csv.length; i++){
	var a = [];
	
	a[0] = csv[i][1]; a[1] = (csv[i][0]); a[2] = csv[i][2];
	A.push(a);
    }
    return A;
}
// read CSV file
//

console.log("CSV station 読み取り中...");
let csvstation = openCSV_in("e2j_station_dic.csv");
console.log("CSV meisho 読み取り中...");
let csvmeisho = openCSV_in("e2j_meisho_dic.csv");
console.log("CSV hotel 読み取り中...");
let csvhotel = openCSV_in("e2j_hotel_dic.csv");
console.log("CSV train 読み取り中...");
let csvtrain = openCSV_in("e2j_train_dic.csv");
console.log("CSV line 読み取り中...");
let csvline = openCSV_in("e2j_line_dic.csv");
console.log("CSV facility 読み取り中...");
let csvfacility = openCSV_in("e2j_facility_dic.csv");
console.log("CSV place 読み取り中...");
let csvplace = openCSV_in("e2j_place_dic.csv");
console.log("CSV bank 読み取り中...");
let csvbank = openCSV_in("e2j_bank_dic.csv");
console.log("CSV event 読み取り中...");
let csvevent = openCSV_in("e2j_event_dic.csv");
console.log("CSV gate 読み取り中...");
let csvgate = openCSV_in("e2j_gate_dic.csv");
console.log("CSV transport 読み取り中...");
let csvtransport = openCSV_in("e2j_transport_dic.csv");
console.log("CSV outplace 読み取り中...");
let csvoutplace = openCSV_in("e2j_outplace_dic.csv");
console.log("CSV ticket 読み取り中...");
let csvticket = openCSV_in("e2j_ticket_dic.csv");

//openCSV_out("./jmeisho2.js", japaneseList(csvmeisho));
//openCSV_out("./jhotel.js", japaneseList(csvhotel));
//openCSV_out("./joutplace.js", japaneseList(csvoutplace));
openCSV_out("./jplace.js", japaneseList(csvplace));
//openCSV_out("./jstation.js", japaneseList(csvstation));

//var mi = csvmeisho;
//mi = mergeCSV(mi, csvmeisho);
//openCSV_out("./mi",makeCSVstring(mi,'\n'));

//openCSV_out("rres.csv", makeCSVstring(irekae(res), '\n'));
//console.log(makeCSVstring(res,','));
//openCSV_out("./ss.js", japaneseList(csv))
var merged = csvstation;
console.log("--- meisho");
merged = mergeCSV(merged, csvmeisho);
console.log("--- hotel");
merged = mergeCSV(merged, csvhotel);
console.log("--- train");
merged = mergeCSV(merged, csvtrain);
console.log("--- line");
merged = mergeCSV(merged, csvline);
console.log("--- facility");
merged = mergeCSV(merged, csvfacility);
console.log("--- place");
merged = mergeCSV(merged, csvplace);
console.log("--- event");
merged = mergeCSV(merged, csvevent);
console.log("--- gate");
merged = mergeCSV(merged, csvgate);
console.log("--- transport", csvtransport);
merged = mergeCSV(merged, csvtransport);
console.log("--- outplace", csvtransport);
merged = mergeCSV(merged, csvoutplace);
console.log("--- ticket", csvtransport);
merged = mergeCSV(merged, csvticket);

openCSV_out("./e2j_dic.org", makeCSVstring(merged,'\n'));

openCSV_out("./l2u_station.csv", makeCSVstring(l2u(csvstation),'\n'));
openCSV_out("./l2u_train.csv", makeCSVstring(l2u(csvtrain),'\n'));
openCSV_out("./list_station_dic", makeCSVLine(csvstation));
openCSV_out("./list_meisho_dic", makeCSVLine(csvmeisho));
openCSV_out("./list_hotel_dic", makeCSVLine(csvhotel));
openCSV_out("./list_train_dic", makeCSVLine(csvtrain));
openCSV_out("./list_line_dic", makeCSVLine(csvline));
openCSV_out("./list_facility_dic", makeCSVLine(csvfacility));
openCSV_out("./list_place_dic", makeCSVLine(csvplace));
openCSV_out("./list_bank_dic", makeCSVLine(csvbank));
openCSV_out("./list_event_dic", makeCSVLine(csvevent));
openCSV_out("./list_gate_dic", makeCSVLine(csvgate));
openCSV_out("./list_transport_dic", makeCSVLine(csvtransport));
openCSV_out("./list_outplace_dic", makeCSVLine(csvoutplace));
openCSV_out("./list_ticket_dic", makeCSVLine(csvticket));

//var A = mergeCSV(res, res2);
//openCSV_out("testout.csv", makeCSVstring(A,'\n'));

