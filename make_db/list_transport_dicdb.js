'use strict'

const Realm = require("realm")

const list_transport_dicdb = {
    name: "list_transport_dicdb",
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

const db = new Realm({path: "../db/list_transport_dic.db", schema: [list_transport_dicdb]});

const dic = require('./list_transport_dic.js');
const list_transport_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_transport_dicdb", list_transport_list);

db.close();
process.exit(0);


