'use strict'

const Realm = require("realm")

const list_gate_dicdb = {
    name: "list_gate_dicdb",
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

const db = new Realm({path: "../db/list_gate_dic.db", schema: [list_gate_dicdb]});

const dic = require('./list_gate_dic.js');
const list_gate_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_gate_dicdb", list_gate_list);

db.close();
process.exit(0);


