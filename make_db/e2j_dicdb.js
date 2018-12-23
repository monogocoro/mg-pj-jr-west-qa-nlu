'use strict'

const Realm = require("realm")

const e2j_dicdb = {
    name: "e2j_dicdb",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
        },
	eword: {
	    type: "string",
	},
	jword: {
	    type: "string",
	},
	hiragana: {
	    type: "string",
	}
    }
}
    
function createDB(db, schema_name, list){
    db.write(() => {
	list.forEach((val, key) => {
	    db.create(
		schema_name,
		val
	    );
        });
    });
}    

const db = new Realm({path: "../db/e2j_dic.db", schema: [e2j_dicdb]});

const dic = require('./e2j_dic.js');
const e2j_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "e2j_dicdb", e2j_list);

db.close();
process.exit(0);


