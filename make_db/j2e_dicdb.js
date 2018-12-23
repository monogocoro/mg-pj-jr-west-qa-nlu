'use strict'

const Realm = require("realm")

const j2e_dicdb = {
    name: "j2e_dicdb",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
        },
	jword: {
	    type: "string",
	},
	eword: {
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

const db = new Realm({path: "../db/j2e_dic.db", schema: [j2e_dicdb]});

const dic = require('./j2e_dic.js');
const j2e_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "j2e_dicdb", j2e_list);

db.close();
process.exit(0);


