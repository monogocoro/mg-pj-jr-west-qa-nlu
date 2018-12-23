'use strict'

const Realm = require("realm")

const list_line_dicdb = {
    name: "list_line_dicdb",
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

const db = new Realm({path: "../db/list_line_dic.db", schema: [list_line_dicdb]});

const dic = require('./list_line_dic.js');
const list_line_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_line_dicdb", list_line_list);

db.close();
process.exit(0);


