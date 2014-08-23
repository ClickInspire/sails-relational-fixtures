var should = require('should'), 
		fixtures = require('../'), 
		Sails = require('sails');

describe('sails-fixtures', function() {
	var data = fixtures.load().objects;
	
	// Load fixtures into memory
	describe('#load()', function() {
		it('should load all of the json files from fixtures folder', function() {
			Object.keys(data).should.have.lengthOf(4);
		});
	});
	
	// Populate DB with fixtures
	describe('#populate()', function() {
    before(function(done) {
			Sails.lift({
        log: {
          level: 'error'
        },
        paths: {
          models: require('path').join(process.cwd(), 'test/fixtures/models')
        }, 
				models: {
					migrate: 'drop'
				}
			}, function(err, sails) {
				if (err) return done(err);
				
				fixtures.populate(function(err) {
					done(err, sails);
				});
			});
		});
		
    after(function(done) {
      sails.lower(done);
    });
		
		it('should load independent fixtures', function(done) {
			Subject.find()
				.then(function(subjects) {
					var subject;
					
					data['subject'].should.be.lengthOf(3);
					subjects.should.be.lengthOf(data['subject'].length);
					
					subject = subjects[0];
					subject.should.have.property('id').type('number');
					subject.should.have.property('name').type('string');
					
					done();
				})
				.fail(done);
		});
		
		it('should load delayed model and collection dependency fixtures', function(done) {
			Classroom.find().populate('students').populate('teacher')
				.then(function(classrooms) {
					var classroom;
					
					data['classroom'].should.be.lengthOf(1);
					classrooms.should.be.lengthOf(data['classroom'].length);
					
					classroom = classrooms[0];
					classroom.should.have.property('id').type('number');
					classroom.should.have.property('teacher').type('object');
					classroom.should.have.property('students').type('object');
					classroom.students.should.be.lengthOf(2);
					
					done();
				})
				.fail(done);
		});
		
		it('should load required dependency fixtures with appropriate associations', function(done) {
			Student.find().populate('teacher').populate('subjects')
				.then(function(students) {
					var student;
					
					data['student'].should.be.lengthOf(2);
					students.should.be.lengthOf(data['student'].length);
					
					student = students[0];
					student.should.have.property('id').type('number');
					student.should.have.property('name').type('string');
					student.should.have.property('teacher').type('object');
					student.should.have.property('subjects').type('object');
					student.subjects.should.be.lengthOf(2);
					
					done();
				})
				.fail(done);
		});
		
		it('should check teacher integrity, since we did all the others', function(done) {
			Teacher.find().populate('students').populate('classroom')
				.then(function(teachers) {
					var teacher;
					
					data['teacher'].should.be.lengthOf(1);
					teachers.should.be.lengthOf(data['teacher'].length);
					
					teacher = teachers[0];
					teacher.should.have.property('id').type('number');
					teacher.should.have.property('name').type('string');
					teacher.should.have.property('classroom').type('object');
					teacher.should.have.property('students').type('object');
					teacher.students.should.be.lengthOf(2);
					
					done();
				})
				.fail(done);
		});
	});
});