'use strict'

const Realm = require("realm")

const list_bank_dicdb = {
    name: "list_bank_dicdb",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
        },
	word: {
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

const db = new Realm({path: "../db/list_bank_dic.db", schema: [list_bank_dicdb]});

const dic = require('./list_bank_dic.js');
const list_bank_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_bank_dicdb", list_bank_list);

db.close();
process.exit(0);


