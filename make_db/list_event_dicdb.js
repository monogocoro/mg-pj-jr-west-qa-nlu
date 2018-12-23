'use strict'

const Realm = require("realm")

const list_event_dicdb = {
    name: "list_event_dicdb",
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

const db = new Realm({path: "../db/list_event_dic.db", schema: [list_event_dicdb]});

const dic = require('./list_event_dic.js');
const list_event_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_event_dicdb", list_event_list);

db.close();
process.exit(0);


