/**
 * Classroom
 *
 * @module      :: Model
 * @description :: A short summary of how this model works and what it represents.
 * @docs		:: http://sailsjs.org/#!documentation/models
 */

module.exports = {

  attributes: {
		teacher: {
			model: 'teacher', 
			via: 'classrooms'
		}, 
		
  	students: {
			collection: 'student'
		}
  }

};