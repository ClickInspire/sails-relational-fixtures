/**
 * Student
 *
 * @module      :: Model
 * @description :: A short summary of how this model works and what it represents.
 * @docs		:: http://sailsjs.org/#!documentation/models
 */

module.exports = {

  attributes: {
  	name: 'string', 
		
		teacher: {
			model: 'teacher', 
			via: 'students', 
			required: true
		}, 
		
		subjects: {
			collection: 'subject'
		}
  }

};