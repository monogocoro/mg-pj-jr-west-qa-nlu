var _ = require('lodash');
const Realm = require('realm');

function getkey(o) {
    return (_.keys(o)[0]);
    //return (Object.keys(o))[0];
}

function getvalue(o) {
    return (_.values(o)[0]);
    //return (Object.values(o))[0];
}

//
// -- word existing check in db
// 
const bankdb = new Realm({path: __dirname+'/db/list_bank_dic.db'});
const bankobjects = bankdb.objects('list_bank_dicdb');
const eventdb = new Realm({path: __dirname+'/db/list_event_dic.db'});
const eventobjects = eventdb.objects('list_event_dicdb');
const facilitydb = new Realm({path: __dirname+'/db/list_facility_dic.db'});
const facilityobjects = facilitydb.objects('list_facility_dicdb');
const gatedb = new Realm({path: __dirname+'/db/list_gate_dic.db'});
const gateobjects = gatedb.objects('list_gate_dicdb');
const hoteldb = new Realm({path: __dirname+'/db/list_hotel_dic.db'});
const hotelobjects = hoteldb.objects('list_hotel_dicdb');
const linedb = new Realm({path: __dirname+'/db/list_line_dic.db'});
const lineobjects = linedb.objects('list_line_dicdb');
const meishodb = new Realm({path: __dirname+'/db/list_meisho_dic.db'});
const meishoobjects = meishodb.objects('list_meisho_dicdb');
const outplacedb = new Realm({path: __dirname+'/db/list_outplace_dic.db'});
const outplaceobjects = outplacedb.objects('list_outplace_dicdb');
const placedb = new Realm({path: __dirname+'/db/list_place_dic.db'});
const placeobjects = placedb.objects('list_place_dicdb');
const stationdb = new Realm({path: __dirname+'/db/list_station_dic.db'});
const stationobjects = stationdb.objects('list_station_dicdb');
const traindb = new Realm({path: __dirname+'/db/list_train_dic.db'});
const trainobjects = traindb.objects('list_train_dicdb');
const transportdb = new Realm({path: __dirname+'/db/list_transport_dic.db'});
const transportobjects = transportdb.objects('list_transport_dicdb');
const ticketdb = new Realm({path: __dirname+'/db/list_ticket_dic.db'});
const ticketobjects = ticketdb.objects('list_ticket_dicdb');

function typeCheck(db, obj){
    // check the value of obj exists in db
    if (obj == undefined) return false;
    var r = db.filtered('word = '+'"'+getvalue(obj)+'"');
    if (JSON.stringify(r) != "{}") return true;
    else return false;
}

function isBANK(obj){
    return typeCheck(bankobjects, obj);
}

function isEVENT(obj){
    return typeCheck(eventobjects, obj);
}

function isFACILITY(obj){
    return typeCheck(facilityobjects, obj);
}

function isGATE(obj){
    return typeCheck(gateobjects, obj);
}

function isHOTEL(obj){
    return typeCheck(hotelobjects, obj);
}

function isLINE(obj){
    return typeCheck(lineobjects, obj);
}

function isMEISHO(obj){
    return typeCheck(meishoobjects, obj);
}

function isOUTPLACE(obj){
    return typeCheck(outplaceobjects, obj);
}

function isPLACE(obj){
    return typeCheck(placeobjects, obj);
}

function isSTATION(obj){
    return typeCheck(stationobjects, obj);
}

function isTRAIN(obj){
    return typeCheck(trainobjects, obj);
}

function isTRANSPORT(obj){
    return typeCheck(transportobjects, obj);
}

function isTICKET(obj){
    return typeCheck(ticketobjects,obj);
}

//
// -- paraphrase checking
//

function paraphraseCheck(type, obj){
    // is possible to praphrase?
    if (obj == undefined) return false;
    var list = eval("list"+type);
    var r = list.indexOf(getvalue(obj));
    if (r >= 0) return true;
    else return false;
}

//-- irregular handling
const listCONVENIENCE_GOODS  = ["beer", "hot-coffee", "coffee", "cigarette", "umbrella", "mineral-water", "water"];
function ptnCONVENIENCE_GOODS(obj){
    return paraphraseCheck("CONVENIENCE_GOODS", obj);
}

// ptn関数: 単に一致を確認するだけでargsに登録はしない。
// is関数：一致したものをargsに登録。したがって$1, $2等で参照可能。
const listTHERE = ["where", "there", "have"];
function ptnTHERE(obj){
    return paraphraseCheck("THERE", obj)
}

const listWHEN = ["when", "what-time"];
function ptnWHEN(obj){
    return paraphraseCheck("WHEN", obj)
}

const listWHAT = ["what"];
function ptnWHAT(obj){
    return paraphraseCheck("WHAT", obj)
}

const listWHERE = ["where"];
function ptnWHERE(obj){
    return paraphraseCheck("WHERE", obj)
}

const listNEAR = ["near", "nearest", "nearby"];
function isNEAR(obj){
    return paraphraseCheck("NEAR", obj);
}

const listOPEN = ["open", "available"];
function adjOPEN(obj){
    return paraphraseCheck("OPEN", obj);
}

const listTAKE = ["take", "catch", "get"];
function vTAKE(obj){
    return paraphraseCheck("TAKE", obj);
}

const listWANT = ["want", "see"];
function vWANT(obj){
    return paraphraseCheck("WANT", obj);
}

const listCHANGE = ["exchange", "change"];
function vCHANGE(obj){
    return paraphraseCheck("CHANGE", obj);
}

const listDEAL = ["sell", "buy", "drink", "want"];
function vDEAL(obj){
    return paraphraseCheck("DEAL", obj);
}

const listWITHDRAW = ["withdraw", "take", "get"];
function vWITHDRAW(obj){
    return paraphraseCheck("WITHDRAW", obj);
}

const listMOVE = ["move", "go", "get"];
function vMOVE(obj){
    return paraphraseCheck("MOVE", obj);
}

const listASK = ["ask", "go"];
function vASK(obj){
    return paraphraseCheck("ASK", obj);
}

const listCAN = ["may", "can"];
function vCAN(obj){
    return paraphraseCheck("CAN", obj);
}

const listACTION = ["take", "upload"];
function vACTION(obj){
        return paraphraseCheck("CAN", obj);
}

const listGOODWORD = ["good", "beautiful", "wonderful", "nice", "fine"];
function adjGOODWORD(obj){
    return paraphraseCheck("GOODWORD", obj);
}

const listSADWORD = ["bad", "strange", "less"];
function adjSADWORD(obj){
    return paraphraseCheck("SADWORD", obj);
}

const listFEELWORD = ["hot", "cold", "sleepy", "tired", "tire", "hard", "uncouncomfortable"];
function adjFEELWORD(obj){
    return paraphraseCheck("FEELWORD", obj);
}

const listDATE = ["today", "tomorrow"];
function isDATE(obj){
    return paraphraseCheck("DATE", obj);
}

//
// -- auxially predicates
// 

function isBANSEN(obj){
    if (getkey(obj) == "number") return true;
    else return false;
}

function isTIME(obj){
    if (getkey(obj) == "time") return true;
    if (getvalue(obj) == "morning") return true;
    else return false;
}

var $bansen;
function isBUSBANSEN(obj){ //駅の番線を問うているのに「みらい」はbus sotpを返す。
    if (getvalue(obj) == undefined) return false;
    var s = (getvalue(obj)).split("-");
    if (s[0] == "bus" && s[1] == "stop"){
	return true;
    }else{
	return false;
    }
}

function isANY(obj){
    return true;
}

function isvariable(v){
    return (v.slice(0,1)=="'");
}

function srules_aux(param){
    return func.aux(param);
}

function comp(v1, v2){
    return v1+"-"+v2;
}

var default_station = '京都';
// 本ルールは基本的には「荒く」意図を取る。
// 以下で意図をつかめなかった場合は、isANYにマッチし、diaglog関数内で詳細に意図を計算。
// ルール：複雑なルールほど上に置く。

/*
// 文脈依存。解決は、$変数を引数にとる「関数」が宣言的述語の中に書けること。
//
それで結構です。
that's fine.

十分です。
It's enough.

もういいです。
That's enough.

これがいいです。
I like this one.

こちらがいいです。
I like this one.

お腹空いた。
ご飯。

*/

module.exports = {make: function (){return( [

    { rule: ["yoshinaga-kameya"],
      ptn: {queryTDB: {from: default_station, to_place: 'shijokawaramachi'}}},

    { rule: ["kameya-yoshinaga"],
      ptn: {queryTDB: {from: default_station, to_place: 'shijokawaramachi'}}},

    { rule: ["famous","kyoto"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["kyoto","famous"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["karasuma-line"],
      ptn: {querySDB: {station: default_station, transport: {name: "karasuma-line"}}}},

    { rule: ["karasuma-line-platform"],
      ptn: {querySDB: {station: default_station, transport: {name: "karasuma-line"}}}},

    { rule: ["kintetsu-line"],
      ptn: {querySDB: {station: default_station, transport: {name: "kintetsuline"}}}},

    { rule: ["kintetsuline"],
      ptn: {querySDB: {station: default_station, transport: {name: "kintetsuline"}}}},

    { rule: [vMOVE, isSTATION, "by", isTRAIN],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {name: '$2'}}}},

    { rule: [isOUTPLACE],
      ptn: {queryTDB: {from: default_station, to_place: '$1'}}},

    { rule: ["how", "long", "take", "from", isSTATION, "to", isSTATION],
      ptn: {queryTDB: {from: '$1', to: '$2', total_time: 'what'}} },
    
    { rule: ["call","station", "staff"],
      ptn: {replyJDB: {greeting: "Please ask a staff near here.#お近くのスタッフにお尋ねください。"}}},
    
    { rule: [vMOVE, isSTATION, "without", isTRAIN],
      ptn: {queryTDB: {from: default_station, to: '$1', excl_train: {name: '$2'}}}},

    { rule: ["commuter-pass"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["book","ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["hirutoku-coupon-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["why", "stop", "over"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  

//    { rule: [isTRANSPORT],
//      ptn: {querySDB: {station: default_station, place: {name: '$1'}}}},

    { rule: ["bus", isMEISHO],
      ptn: {queryTDB: {from: default_station, to_place: '$1', route:'bus'}} },

    { rule: [isTRANSPORT, "to", isHOTEL],
      ptn: {querySDB: {station: default_station, transport:{name: '$1', to: '$2'}} }},

    { rule: [ptnTHERE, isPLACE, "inside", "station"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'in'}}} },

    { rule: ['nara-line-stair'],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [isPLACE, "for", isTRANSPORT],
      ptn: {querySDB: {station: default_station, place: {name: '$1', brand: '$2'}}}},
    // PLACE
    { rule: [isPLACE, "inside", "ticket-gate"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'ingate'}}} },

    { rule: [isPLACE, "outside", "ticket-gate"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'outgate' }}} },

    { rule: [ptnTHERE, isPLACE, "inside", "station"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'in'}}} },

    { rule: [ptnTHERE, isPLACE, "outside", "station"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'out'}}} },

    { rule: [ptnTHERE, isPLACE, adjOPEN, "until", "time"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', status: 'open'}}} },

    { rule: [ptnTHERE, isPLACE, adjOPEN],
      ptn: {querySDB: {station: default_station, place: {name: '$1', status: 'open'}}} },

    { rule: [ptnWHEN, isPLACE, adjOPEN],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'open', time: 'what'}}} },

    { rule: [isPLACE, "open"],
      ptn: {querySDB: {station: default_station,  place: {name: '$1', staus: 'open'}}} },

    { rule: [ptnTHERE, isPLACE, "smoke"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', smoking: 'yes'}}} },

    { rule: [isPLACE, "smoke"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', smoking: 'yes'}}} },

    { rule: ["smoke"],
      ptn: {querySDB: {station: default_station, place: {name: 'smoking-area'}}}},

    { rule: [ptnTHERE, isPLACE, "bunen"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', smoking: 'bunen'}}} },

    { rule: [ptnTHERE, isNEAR, isPLACE],
      ptn: { querySDB: { station: default_station, place: {name: '$2', location: '$1'}}} },

    { rule: [ptnTHERE, isPLACE, isNEAR],
      ptn: { querySDB: { station: default_station, place: {name: '$1', location: '$2'}}} },

    { rule: [isNEAR, isPLACE],
      ptn: { querySDB: { station: default_station, place: {name: '$2', location: '$1'}}} },

    { rule: [ptnTHERE, isPLACE],
      ptn: { querySDB: { station: default_station, place: {name: '$1'}}} },

    { rule: [isPLACE],
      ptn: { querySDB: {station: default_station, place: {name: '$1'}}} },
    
    // STATION
    { rule: ["to", isSTATION, "with", isTICKET],
      ptn: {queryTDB: {form: default_station, to:'$1', ticket: {name: '$2'}}}},
    
    { rule: ["fare", "from", isSTATION, "to", isSTATION],
      ptn: {queryTDB: {from: '$1', to: '$2', fare: 'what'}} },

    { rule: ["from", isSTATION, "to", isSTATION],
      ptn: {queryTDB: {from: '$1', to: '$2'}}},
    
    { rule: ["fare", "to", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', fare: 'what'}} },

    { rule: ["how", "much", "to", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', fare: 'what'}} },

    { rule: ["how", "long", "take", "from", isSTATION, isSTATION],
      ptn: {queryTDB: {from: '$1', to: '$2', total_time: 'what'}} },

    { rule: ["how", "long", "take", "from", isSTATION, "to", isSTATION],
      ptn: {queryTDB: {from: '$1', to: '$2', total_time: 'what'}} },

    { rule: ["how", "long", "take", "to",  isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', total_time: 'what'}} },

    { rule: ["how", "far", "from", isSTATION, isSTATION],
      ptn: {queryTDB: {from: '$1', to: '$2', total_time: 'what'}} },

    { rule: ["how", "far", "to",  isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$2', total_time: 'what'}} },

    { rule: ["platform", "to", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', train:{bansen: 'what'}}}},

    { rule: ["platform", "for", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', train:{bansen: 'what'}}}},

    { rule: ["platform", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', train:{bansen: 'what'}}}},

    { rule: ["sit", "down", isSTATION],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [isSTATION, "local", "train"],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {type: 'local'}}}},

    { rule: [isSTATION, "special", "rapid"],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {type: '新快速'}}}},

    { rule: [isSTATION, "miyakoji-rapid-service"],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {type: '都路快速'}}}},

    { rule: ["miyakoji-rapid-service-stop", "stop", isSTATION],
      ptn: {queryTDB: {from: default_station, at_stop: '$1', train: {type: '都路快速'}}}},

    { rule: ["special","rapid", isSTATION],
      ptn: {queryTDB: {from: default_station, at_stop: '$1', train: {type: '新快速'}}}},

    { rule: ["express", "stop", isSTATION],
      ptn: {queryTDB: {from: default_station, at_stop: '$1', train: {type: '快速'}}}},

    { rule: ["express", "trai-stop", isSTATION],
      ptn: {queryTDB: {from: default_station, at_stop: '$1', train: {type: '快速'}}}},

    { rule: ["which", "stop", isSTATION],
      ptn: {queryTDB: {from: default_station, at_stop: '$1', train: {name: 'what'}}}},

    { rule: ["where", vTAKE, isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {bansen: 'what'}}}},

    { rule: ["train", "late"],
      ptn: {queryTDB: {from: default_station, to: 'what', time: 'late'}}},

    { rule: ["first", "train", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', time: '始発'}}},

    { rule: ["senchaku-train", isSTATION, isSTATION],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  

    { rule: ["senchaku", "or"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  

    { rule: ["senchaku-train", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', time: '先着'}}},

    { rule: ["senchaku", isSTATION, isSTATION],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  

    { rule: ["senchaku", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', time: '先着'}}},

    { rule: ["bus", isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1', route: 'bus'}}},
    
    { rule: [vMOVE, isSTATION, "delay"],
      ptn: {queryTDB: {from: default_station, to: '$1', time: 'late'}} },
    
    { rule: [vMOVE, isSTATION, "jr"],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {type: 'JR'}}}},

    { rule: [vMOVE, isSTATION, "conventional", "line"],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {type: '各停'}}}},

    { rule: [vMOVE, isSTATION, isTRAIN],
      ptn: {queryTDB: {from: default_station, to: '$1', train: {name: '$2'}}}},
    
    { rule: [vMOVE, isSTATION],
      ptn: {queryTDB: {from: default_station, to: '$1'}} },

    { rule: ["senchaku-train", isSTATION],
      ptn: {queryTDB: {from: default_station, to: 'what', time: '先着'}}},

    { rule: [isSTATION],
      ptn: { queryTDB: { from: default_station, to: '$1'}} },


    // WiFi
    { rule: ["wi-fi"],
      ptn: {querySDB: {station: default_station, place: {name: 'wi-fi'}}}},

    { rule: ["post", "office"],
      ptn: {querySDB: {station: default_station, place: {name: 'post-office'}}}},

    // EVENT 飛び地
    { rule: ["recommend", "kyoto"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["recommendation", "kyoto"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},


    { rule: ["recommend", isPLACE],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["what-temple", "recommend"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["koyo"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["recommended-koyo"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["recommended-temple"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},


    { rule: ["which-koyo", "recommend"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},


    { rule: ["red", "leaf"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["sightsee-spot", "station"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["sightseeing", "spot", "recommend"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["sightseeing-spot","recommend"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    // MEISHO 飛び地
    { rule: ["nearest", "station", isMEISHO],
      ptn: {queryTDB: {from: default_station, to: 'what',to_place: '$1'}}},

    { rule: [vMOVE, isSTATION, "without", isTRAIN],
      ptn: {queryTDB: {from: default_station, to: '$1', excl_train: {name: '$2'}}}},


    { rule: ["tokkyu-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["shinkansen-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["haruka-tokkyu-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["long", "distance-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["kanku-tokkyu-haruka-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    { rule: ["kinkyoriken"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},

    // excuse

    
    { rule: ["many", "restaurant"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["cheap", "hotel"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    { rule: ["guest-house"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},
      
    { rule: ["barrier-free", "route"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [ptnTHERE, "event"],
      ptn: {replyJDB: {greeting: "I'm afraid I don't have the information.#申し訳ありません。情報がありません。"}}},

    { rule: ["want", "go", isSTATION, "but"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [isTRAIN, "free", "seat"],
      ptn: {replyJDB: {greeting: "I'm afraid I don't have the information.#申し訳ありません。情報がありません。"}}},

    { rule: ["unreserved", "seat", isTRAIN],
      ptn: {replyJDB: {greeting: "I'm afraid I don't have the information.#申し訳ありません。情報がありません。"}}},

    { rule: ["unreserved", "seat-number", isTRAIN],
      ptn: {replyJDB: {greeting: "I'm afraid I don't have the information.#申し訳ありません。情報がありません。"}}},

    { rule: ["free", "seat", isTRAIN],
      ptn: {replyJDB: {greeting: "I'm afraid I don't have the information.#申し訳ありません。情報がありません。"}}},

    { rule: ["miss", "stop"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["change", "train-time"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["vend-machine"],
      ptn: {replyJDB: {greeting: "I'm afraid I don't know.#申し訳ありません。情報がありません。"}}},

    { rule: ["wheelchair"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [isBUSBANSEN],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["use", "where","should","go"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},
    
    { rule: ["station-stamp"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [ptnTHERE, "can", "charge"],
      ptn: {replyJDB: {greeting: "I'm afraid I don't have the information.#申し訳ありません。情報がありません。"}}},

    
    // ticket
    { rule: ["comuter-pass"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}}, 
														   
    { rule: ["puratto-kodama-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},
    
    { rule: ["japan-rail-pass"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},
    
    { rule: ["one-day", "subway-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},
    
    { rule: ["ticket-office", "city-bus"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["stop", "over", "ticket"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["wrong", "ticket", "refund"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["enter", "go", "out"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["enter", "same", "time"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["pass", "ticket", "machine"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["pass", "ticket", "machine"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["which", "ticket", "insert"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["why", "need"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["can", "shinkansen", "west-rail-pass"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: ["hirutoku-coupon-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},
    
    { rule: ["coupon-ticket"],
      ptn: {replyJDB: {greeting: "Please ask at midorino-madoguchi.#みどりの窓口をご案内いたします。"}}},
    
    { rule: ["exic-card"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},

    { rule: [isTICKET],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},


    // greetins

    { rule: ["how", "be", "you"],
      ptn: {replyJDB: {greeting: "I'm fine. Thank you.#元気です。ありがとうございます。"}}},
    
    { rule: ["how", "do", "you", "do"],
      ptn: {replyJDB: {greeting: "Nice to meet you.#こちらこそよろしくお願いします。"}}},

    { rule: ["hello"],
      ptn: {replyJDB: {greeting: "Nice to meet you.#よろしくお願いします。"}}},
    
    { rule: ["good","morning"],
      ptn: {replyJDB: {greeting: "Good morning.#おはようございます。"} }},

    { rule: ["good","afternoon"],
      ptn: {replyJDB: {greeting: "Good afternoon.#こんにちわ。"} }},

    { rule: ["good","evening"],
      ptn: {replyJDB: {greeting: "Good evening.#こんばんわ。"} }},

    { rule: ["good", "night"],
      ptn: {replyJDB: {greeting: "Good night.#おやすみなさい。"}}},
    
    { rule: ["good-bye"],
      ptn: {replyJDB: {greeting: "Thank you very much.#ありがとうございました。"}}},
    
    { rule: ["thank", "you"],
      ptn: {replyJDB: {greeting: "You are welcome.#どういたしまして。"}}},

    { rule: [adjGOODWORD, "day"],
      ptn: {replyJDB: {greeting: "It's nice day.#いい日ですね。"}}},

    { rule: [ptnWHAT, "name"],
      ptn: {replyJDB: {greeting: "I am a virtual attendant AKANE.#わたくし、バーチャルアテンダントの茜と申します。"}}},

    { rule: ["may", "have", "name"],
      ptn: {replyJDB: {greeting: "I am a virtual attendant AKANE.#わたくし、バーチャルアテンダントの茜と申します。"}}},

    { rule: ["how", "old"],
      ptn: {replyJDB: {greeting: "I'm afraid I can't answer.#お答えできません。"}}},

    /*
    { rule: ["not", adjGOODWORD],
      ptn: {replyJDB: {greeting: "I'm sad to hear it.#残念です。" }}},

    { rule: [adjGOODWORD],
      ptn: {replyJDB: {greeting: "I'm glad to hear it.#ありがとうございます。" }}},

    { rule: [adjSADWORD],
      ptn: {replyJDB: {greeting: "I'm sad to hear it.#残念です。" }}},
      */

    //駅構外

    { rule: [ptnTHERE, "bus", "to", isPLACE],
      ptn: {querySDB: {station: default_station,  transport: {name: 'bus', to: '$1'}}} },
    
    { rule: [ptnTHERE, "rental", "car"],
      ptn: {querySDB: {station: default_station,  place: {name: 'renta-a-car'}}} },

    { rule: [isTRANSPORT],
      ptn: {querySDB: {station: default_station, place: {name: '$1'}}}},



    
    // 路線・番線
    { rule: ["keihan-electric-railway"],
      ptn: {queryTDB: {from: default_station, to: 'tofukuji', to_place: 'keihan-electric-railway'}}},

    { rule: ["keihan-line"],
      ptn: {queryTDB: {from: default_station, to: 'tofukuji', to_place: 'keihan-line'}}},

    { rule: ["hankyu-railway"],
      ptn: {queryTDB: {from: default_station, to: 'kawaramachi', to_place: 'hankyu-railway'}}},

    { rule: ["hankyu-train"],
      ptn: {queryTDB: {from: default_station, to: 'kawaramachi', to_place: 'hankyu-train'}}},

    { rule: [ptnTHERE, vTAKE, isLINE],
      ptn: {querySDB: {station: default_station, line: {name: '$1', bansen: 'what'}}} },

    { rule: [ptnTHERE, isLINE],
      ptn: { querySDB: { station: default_station, transport: {name: '$1'}}} },

    { rule: [ptnTHERE, isBANSEN],
      ptn: { querySDB: { station: default_station, bansen: '$1'}} },

    { rule: [isLINE, isTIME, isBANSEN],
      ptn: {isquerySDB: {station: default_station, line: {name: '$1', bansen: '$3', time: '$2'}}} },

    
    { rule: [isLINE],
      ptn: { querySDB: { station: default_station, line: {name: '$1', bansen: 'what'}}} },


    // ATM
    { rule: ["seven-bank-atm"],
      ptn: {querySDB: {station: default_station, place: {name: 'atm', brand: 'seven-bank'}}}},

    { rule: [isBANK, "atm"],
      ptn: {querySDB: {station: default_station, place: {name: 'atm', brand: '$1'}}}},

    { rule: ["atm", isBANK],
      ptn: {querySDB: {station: default_station, place: {name: 'atm', brand: '$1'}}}},

    { rule: [ptnTHERE, vWITHDRAW, "money"],
      ptn: {querySDB: {station: default_station,  place: {name: 'atm'}}} },

    { rule: [vWITHDRAW, "money"],
      ptn: {querySDB: {station: default_station,  place: {name: 'atm'}}} },

    // 両替
    { rule: ["change-money"],
      ptn: {querySDB: {station: default_station,  place: {name: 'money-change'}}} },

    { rule: ["money-change"],
      ptn: {querySDB: {station: default_station,  place: {name: 'money-change'}}} },

    { rule: ["change","money"],
      ptn: {querySDB: {station: default_station,  place: {name: 'money-change'}}} },

    { rule: ["money","change"],
      ptn: {querySDB: {station: default_station,  place: {name: 'money-change'}}} },

    // restaurant
    { rule: ["ramen"],
      ptn: {querySDB: {station: default_station, place:{name: 'ramen'}}}},

    { rule: ["ramen-shop"],
      ptn: {querySDB: {station: default_station, place:{name: 'ramen'}}}},

    { rule: ["japanese", "food"],
      ptn: {querySDB: {station: default_station, place:{name: 'japanese-food'}}}},

    { rule: ["chinese", "food"],
      ptn: {querySDB: {station: default_station, place:{name: 'chinese-food'}}}},

    { rule: ["kyoto", "dish"],
      ptn: {querySDB: {station: default_station, place:{name: 'kyoto-cuisine'}}}},

    { rule: ["kyoto", "food"],
      ptn: {querySDB: {station: default_station, place:{name: 'kyoto-cuisine'}}}},

    { rule: ["western", "food"],
      ptn: {querySDB: {station: default_station, place:{name: 'western-food'}}}},

    { rule: [ptnTHERE, "place", "eat"],
      ptn: {querySDB: {station: default_station,  place: {name: 'restaurant'}}}  },

    // weather

    { rule: ["weather", isDATE],
       ptn: {queryWTR: {date: '$1'}} },

    { rule: ["today-&s-weather"],
       ptn: {queryWTR: {date: 'today'}} },

    { rule: ["tomorrow-&s-weather"],
       ptn: {queryWTR: {date: 'tomorrow'}} },

    // EVENT
    { rule: [ptnWHERE, isEVENT],
      ptn: { queryEDB: {station: default_station, event: {name: '$1',location: 'what'}}}},

    { rule: [ptnWHEN, isEVENT],
      ptn: { queryEDB: {station: default_station, event: {name: '$1',period: 'what'}}}},

    { rule: ["sightsee-spot", isSTATION],
      ptn: {queryEDB: {from: default_station, spot:{name:'what', location:'$1'}}}},


    { rule: ["sightsee-spot", isMEISHO],
      ptn: {queryEDB: {from: default_station, spot:{name:'what', location:'$1'}}}},

    { rule: ["famous", isSTATION],
      ptn: {queryEDB: {from: default_station, spot:{name:'what', location:'$1'}}}},

    { rule: ["famous", isMEISHO],
      ptn: {queryEDB: {from: default_station, spot:{name:'what', location:'$1'}}}},

    { rule: ["play", isSTATION],
      ptn: {queryEDB: {from: default_station, spot:{name:'what', location:'$1'}}}},

    { rule: ["play", isMEISHO],
      ptn: {queryEDB: {from: default_station, spot:{name:'what', location:'$1'}}}},

    // TRAIN
    { rule: ["what-number", "platform", isTRAIN],
      ptn: { querySDB: { station: default_station, train:  {name: '$1', bansen: 'what'}}} },

    { rule: [ptnTHERE, "platform", "arrival", isTRAIN],
      ptn: {querySDB: {station: default_station, train: {name: '$1', tochaku_bansen: 'what'}}} },

    { rule: [ptnTHERE, "platform", isTRAIN],
      ptn: {querySDB: {station: default_station, train: {name: '$1', bansen: 'what'}}} },

    { rule: [isTRAIN, "leave", "at", isTIME, isBANSEN],
      ptn: {isquerySDB: {station: default_station, train: {name: '$1', time: '$2', bansen: '$3'}}} },

    { rule: [ptnTHERE, vTAKE, isTRAIN],
      ptn: {querySDB: {station: default_station, train: {name: '$1', bansen: 'what'}}} },

    { rule: [isTRAIN],
      ptn: { querySDB: { station: default_station, train: {name: '$1', bansen: 'what'}}} },

    // ホテル
    { rule: [isTRANSPORT, "to", isHOTEL],
      ptn: {querySDB: {station: default_station, transport:{name: '$1', to: '$2'}} }},

    { rule: [vMOVE, isHOTEL],
      ptn: {querySDB: {station: default_station,  place: {name: '$1'}}} },

    { rule: [isHOTEL],
      ptn: { querySDB: {station: default_station, place: {name: '$1'}}} },
  


    // 名所
    { rule: [vMOVE, isMEISHO],
      ptn: {queryTDB: {from: default_station, to_place: '$1'}} },

    { rule: ["bus", isMEISHO],
      ptn: {queryTDB: {from: default_station, to_place: '$1', route:'bus'}} },


    { rule: [isMEISHO],
      ptn: { queryTDB: {from: default_station, to_place: '$1'}} },

    { rule: ["temple"],
      ptn: {replyJDB: {greeting: "Pleas ask the tourist information center on the second floor.#2階観光案内所にお尋ねください。"}}},

    // TRANSPORT

    {rule: [ptnTHERE, "bus-stop", isTRANSPORT],
     ptn: { querySDB: { station: default_station, transport: {name: '$1'}}} },
    
    { rule: [ptnTHERE, isTRANSPORT, "to", isPLACE],
      ptn: {querySDB: {station: default_station,  transport: {name: '$1', to: '$2'}}} },

    { rule: [ptnTHERE, isTRANSPORT],
      ptn: {querySDB: {station: default_station,  transport: {name: '$1'}}} },

    { rule: [isTRANSPORT],
      ptn: { querySDB: { station: default_station, transport: {name: '$1'}}} },

    // GATE
    { rule: [ptnTHERE, isGATE],
      ptn: {querySDB: {station: default_station,  gate: {name: '$1'}}} },

    { rule: [vMOVE, isGATE],
      ptn: { querySDB: { station: default_station, gate: {name: '$1'}}} },

    { rule: [isGATE],
      ptn: { querySDB: {station: default_station, place: {name: '$1'}}} },
    
    //コンビニ
    { rule: [vDEAL, ptnCONVENIENCE_GOODS, isNEAR],
      ptn: { querySDB: { station: default_station, place: {name: 'convenience-store', locatoin: '$1'}}} },

    { rule: [vDEAL, ptnCONVENIENCE_GOODS],
      ptn: { querySDB: { station: default_station, place: {name: 'convenience-store'}}} },

    //弁当類
    { rule: [ptnTHERE, vDEAL, "ekiben"],
      ptn: { querySDB: { station: default_station, place: {name: 'ekiben-shop'}}} },
    
    { rule: [vWANT, "souvenir"],
      ptn: {querySDB: {station: default_station, place: {name: 'souvenir-shop'}}} },

    // 構内案内

    { rule: [ptnTHERE, isFACILITY],
      ptn: { querySDB: { station: default_station, place: {name: '$1'}}} },

    { rule: [ptnWHEN, "start", "morning"],
      ptn: {replyJDB: {greeting: "We starts service from 10 am.#10時からサービスを提供します。"}}},

    { rule: ["from", ptnWHEN, "to", "open"],
      ptn: {replyJDB: {greeting: "We provide service from 10 am to 4 pm.#朝10時から4時までサービスを提供します。"}}},

    { rule: ["how", "late", "open"],
      ptn: {replyJDB: {greeting: "We provide service until 4 pm.#4時までサービスを提供します。"}}},

    { rule: [ptnWHEN, isFACILITY, "open"],
      ptn: {querySDB: {station:default_station, place:{name: '$1', status: 'open', time: 'what'}}}},

    { rule: [ptnWHEN, isFACILITY, "close"],
      ptn: {querySDB: {station:default_station, place:{name: '$1', status: 'close', time: 'what'}}}},

    { rule: [ptnWHEN, "shutter-close"],
      ptn: {querySDB: {station:default_station, place:{name: 'shutter', status: 'close', time: 'what'}}}},

    { rule: [ptnWHEN, "open"],
      ptn: {replyJDB: {greeting: "We starts service from 10 am.#10時からサービスを提供します。"}}},

    { rule: ["how", "late", "here"],
      ptn: {replyJDB: {greeting: "We provide service until 4 pm.#4時までサービスを提供します。"}}},

    { rule: ["until", ptnWHEN, "work"],
      ptn: {replyJDB: {greeting: "We provide service until 4 pm.#4時までサービスを提供します。"}}},

    { rule: ["how", "long", "be", "here"],
      ptn: {replyJDB: {greeting: "We are here from November 13th.#11月13日からいます。"}}},

    { rule: ["how", "long", "stay", "here"],
      ptn: {replyJDB: {greeting: "We are here until November 15th.#11月15日までいます。"}}},

    { rule: [ptnWHAT, "can", "do"],
      ptn: {replyJDB: {greeting: "I guide the inside and the outside of the station.#駅周辺の情報をご案内いたします。"}}},

    { rule: [ptnWHAT, "hour"],
      ptn: {replyJDB: {greeting: "We provide service from 10 am to 4 pm.#朝10時から4時までサービスを提供します。"}}},

    { rule: [vCAN, "take", "picture"],
      ptn: {replyJDB: {greeting: "You are permitted to take picture.#写真は自由にお撮りください。"}}},

    { rule: [vCAN, "take", "video"],
      ptn: {replyJDB: {greeting: "You are permitted to take video.#ビデオは自由にお撮りください。"}}},

    { rule: [vCAN, "upload", "sns"],
      ptn: {replyJDB: {greeting: "You are permitted to upload to SNS.#SNSへの投稿はご自由です。"}}},

    { rule: [vCAN, "put", "on"],
      ptn: {replyJDB: {greeting: "You are permitted to upload to SNS.#SNSへの投稿はご自由です。"}}},

    { rule: ["not", "well", "call"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  

    { rule: ["pain", "sit", "down"],
      ptn: {querySDB: {station: default_station, place: {name: "resting-room"}}}},

    { rule: ["tired", "rest"],
      ptn: {querySDB: {station: default_station, place: {name: "resting-room"}}}},

    { rule: ["place", "rest"],
      ptn: {querySDB: {station: default_station, place: {name: "resting-room"}}}},

    { rule: ["be", "lose"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  
      
    { rule: ["call", "station-staff"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  
    
    { rule: ["lose", "child"],
      ptn: {replyJDB: {greeting: "Please ask the station staff.#恐れ入ります。駅係員にお尋ねください。"}}},  

    { rule: ["where", "am-i"],  //ここはどこですか。enju bug for "where am I? <noun>am
      ptn: {replyJDB: {greeting: "We are near the central gate.#こちらは京都駅　中央口付近です。"}}},

    { rule: ["leave", "something", "and", ptnTHERE, vASK],
      ptn: {querySDB: {station: default_station, place: {name: 'luggage-claim'}}} },

    { rule: ["lose", "something", "and", ptnTHERE, vASK],
      ptn: {querySDB: {station: default_station, place: {name: 'luggage-claim'}}} },

    { rule: ["check", "baggage"],
      ptn: {querySDB: {station: default_station, place: {name: 'luggage-room'}}} },

    { rule: [ptnTHERE, "meet"],
      ptn: {querySDB: {station: default_station,  place: {name: 'waiting-place'}}} },

        // FACILITY
    { rule: [isFACILITY, isLINE],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: '$2'}}}},
    
    { rule: [isFACILITY, "inside", "ticket-gate"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'ingate'}}} },

    { rule: [isFACILITY, "outside", "ticket-gate"],
      ptn: {querySDB: {station: default_station, place: {name: '$1', location: 'outgate' }}} },
    
    { rule: ["how", "late", isFACILITY, adjOPEN],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'close', time: 'what'}}}},
    
    { rule: [ptnTHERE, isFACILITY, adjOPEN],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'open'}}} },

    { rule: [ptnWHEN, isFACILITY, adjOPEN],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'open', time: 'what'}}} },

    { rule: [ptnWHEN, "enter", isFACILITY],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'open', time: 'what'}}} },

    { rule: [ptnWHEN, isFACILITY, "close"],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'close', time: 'what'}}} },

    { rule: [isFACILITY, "from", ptnWHEN],
      ptn: { querySDB: { station: default_station, place: {name: '$1', status: 'open', time: 'what'}}} },

    { rule: [vWANT, "map", "around", "station"],
      ptn: {querySDB: {station: default_station, map: {name: comp('around', 'station')}}} },

    { rule: ["universal", "bathroom"],
      ptn: { querySDB: {station: default_station, place: {name: 'multi-purpose-bathroom'}}}},

    { rule: ["multi-purpose", "bathroom"],
      ptn: { querySDB: {station: default_station, place: {name: 'multi-purpose-bathroom'}}}},

    { rule: [isFACILITY], //"station"に一致する。
      ptn: { querySDB: {station: default_station, place: {name: '$1'}}} },

    { rule: [isANY],
      ptn: {replyJDB: {greeting: "I'm afraid I haven't information .#申し訳ありません、情報がありません。"}}},
    
    /*
      ルールの中に関数を書きたい。その実験。
    { rule: [isANY],
      ptn: { replyJDB: srules_aux('$scode') }},
    { rule: [isANY],
      ptn: {replyJDB: srules_aux('$callbackfunc_$1')}}
      */
    
    ])}}

//process.exit(0)
