'use strict'

const Realm = require("realm")

const list_place_dicdb = {
    name: "list_place_dicdb",
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

const db = new Realm({path: "../db/list_place_dic.db", schema: [list_place_dicdb]});

const dic = require('./list_place_dic.js');
const list_place_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_place_dicdb", list_place_list);

db.close();
process.exit(0);


