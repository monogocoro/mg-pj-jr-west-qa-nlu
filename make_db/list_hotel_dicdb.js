'use strict'

const Realm = require("realm")

const list_hotel_dicdb = {
    name: "list_hotel_dicdb",
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

const db = new Realm({path: "../db/list_hotel_dic.db", schema: [list_hotel_dicdb]});

const dic = require('./list_hotel_dic.js');
const list_hotel_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_hotel_dicdb", list_hotel_list);

db.close();
process.exit(0);


