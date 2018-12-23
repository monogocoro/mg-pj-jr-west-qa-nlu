'use strict'

const Realm = require("realm")

const list_meisho_dicdb = {
    name: "list_meisho_dicdb",
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

const db = new Realm({path: "../db/list_meisho_dic.db", schema: [list_meisho_dicdb]});

const dic = require('./list_meisho_dic.js');
const list_meisho_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_meisho_dicdb", list_meisho_list);

db.close();
process.exit(0);


