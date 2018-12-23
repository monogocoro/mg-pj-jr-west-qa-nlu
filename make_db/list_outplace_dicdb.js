'use strict'

const Realm = require("realm")

const list_outplace_dicdb = {
    name: "list_outplace_dicdb",
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

const db = new Realm({path: "../db/list_outplace_dic.db", schema: [list_outplace_dicdb]});

const dic = require('./list_outplace_dic.js');
const list_outplace_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_outplace_dicdb", list_outplace_list);

db.close();
process.exit(0);


