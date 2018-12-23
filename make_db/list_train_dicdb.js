'use strict'

const Realm = require("realm")

const list_train_dicdb = {
    name: "list_train_dicdb",
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

const db = new Realm({path: "../db/list_train_dic.db", schema: [list_train_dicdb]});

const dic = require('./list_train_dic.js');
const list_train_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_train_dicdb", list_train_list);

db.close();
process.exit(0);


