'use strict'

const Realm = require("realm")

const list_ticket_dicdb = {
    name: "list_ticket_dicdb",
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

const db = new Realm({path: "../db/list_ticket_dic.db", schema: [list_ticket_dicdb]});

const dic = require('./list_ticket_dic.js');
const list_ticket_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_ticket_dicdb", list_ticket_list);

db.close();
process.exit(0);


