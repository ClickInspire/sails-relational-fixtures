// Libraries
var Q = require('q'), 
		fs = require('fs'), 
		path = require('path'), 
		
		activeSet = {}, 
		backlogSet = {},
		
		// Shared arrays... probably a better way of doing this.
		independentFixtures = [],
		delayedDependencyFixtures = [],
		requiredDependencyFixtures = [], 
		associativeProcessing = [],
		completedFixtures = [],
		
		fixtureNames;


SailsFixtures = {
	objects: {},
	
	/**
	 * Read fixtures from JSON files into `objects`
	 * @param  {String} [folder='<project_root>/test/fixtures'] path to fixtures
	 * @return {Object} this module, where the objects member is holding loaded fixtures
	 */
	load: function(folder) {
		var files, 
				modelName;

		folder = folder || process.cwd() + '/test/fixtures';
		files = fs.readdirSync(folder);

		for (var i = 0; i < files.length; i++) {
			if (getFileExtension(files[i]) === '.json')	{
				modelName = fileToModelName(files[i]);
				this.objects[modelName] = require(path.join(folder, files[i]));
			}
		}

		return this;
	}, 
	

  /*
   * Translate the JSON data into Fixtures objects.
   *
   * @param  {Object} [data] JSON data to process
	 * @return {Array} list of Fixture objects
   */
	dataToFixtures: function(data) {
		var fixtures = [];
		
		_.each(this.fixtureNames, function(fixtureName) {
			var Model = sails.models[fixtureName];
			
			if (Model) {
				_.each(data[fixtureName], function(fixtureData) {
					fixtures.push(new Fixture(fixtureName, fixtureData));
				});
			} else {
				throw new Error('Model ' + fixtureName + ' could not be found in sails.models.');
			}
		});
		
		return fixtures;
	},

  /*
   * Populate the sails model with the fixture data.
   *
   * @param  {Function} done   callback function with signature done(err, result)
   * @param  {String}   [folder] path to fixture, only used if fixtures is not loaded yet
   */
  populate: function (done, folder) {
		var that = this, 
				data = this.objects;
		
    if (Object.keys(data).length === 0) {
			this.load(folder);
		}	
		
		this.fixtureNames = Object.keys(data);
		backlogSet = this.dataToFixtures(data);
		
		this.obliterateDatabase()
			.then(function() {
				that._processBacklogRecursive(done, 1);
			})
			.catch(done);
	},
	
  /*
   * Recursively process the backlog until all required dependencies have been resolved.
	 * Then fix up the delayed dependencies and return.
   *
   * @param  {Function} [done] callback function with signature done(err, result)
   * @param  {String} [round] current round of recursion.
   */
	_processBacklogRecursive: function (done, round) {
		var that = this;
		
		if (backlogSet.length === 0) {
			that.processMissingAssociations()
				.then(function() {
					done();
				})
				.catch(function(err) {
					done()
				});
		} else {
			activeSet = backlogSet;
			backlogSet = [];
			
			this.groupFixturesByDependencyType(activeSet, round);
			
			this.createFixtures()
				.then(function() {
					round = round + 1;
					return that._processBacklogRecursive(done, round);
				})
				.catch(done);
		}
	}, 
	
  /*
   * Kill all of the models in the database.
	 * TODO: This should be switched out for a model check in case we just want to ensure the entities are there upon launch. (non-testing purposes)
   */
	obliterateDatabase: function() {
		var destroyPromises = [];

		_.each(this.fixtureNames, function(fixtureName) {
			var Model = sails.models[fixtureName];

			if (Model) {
				destroyPromises.push(Model.destroy());
			} else {
				throw new Error("Model " + fixtureName + " could not be found in sails.models.");
			}
		});

		return Q.all(destroyPromises);
	},
	
  /**
   * Create all of the fixtures in order using grouped arrays.
   */
	createFixtures: function () {
		var that = this,
				independent, 
				dependencyNotRequired;
		
		promiseIndependent = this.saveFixturesFromArray(independentFixtures);
		promiseDelayedDependency = this.saveFixturesFromArray(delayedDependencyFixtures);
		
		promise = Q.all([ promiseIndependent, promiseDelayedDependency ])
			.then(function(models) {
				return that.saveFixturesFromArray(requiredDependencyFixtures);
			});
		
		return promise;
	}, 
	
	/*
	 * Set arrays of each dependency type so we can process one before the other as needed.
	 *
	 * @param {Fixture} [fixtures] array of all fixtures to process for grouping.
	 * @param {integer} [round] number used ensure we add all fixtures ONLY ONCE to an array for association assignment later on. (Could be separated out...)
	 */
	groupFixturesByDependencyType: function(fixtures, round) {
		requiredDependencyFixtures = [];
		delayedDependencyFixtures = [];
		independentFixtures = [];
	
		_.each(fixtures, function(fixture) {
			if (fixture.hasRequiredDependencies()) { 
				requiredDependencyFixtures.push(fixture);
			} else if (fixture.hasDelayedDependencies()) {
				delayedDependencyFixtures.push(fixture);
			} else {
				independentFixtures.push(fixture);
			}
			
			if (round === 1 && fixture.hasDelayedDependencies()) {
				associativeProcessing.push(fixture);
			}
		});
	},
	
	/*
	 * Loops through an array of fixtures to save them, used for multiple types of fixtures separated out earlier.
	 */
	saveFixturesFromArray: function(fixtures) {
		var that = this, 
				promiseCreation = [];

		_.each(fixtures, function(fixture) {
			promiseCreation.push(fixture.create());
		});
		
		return Q.all(promiseCreation);
	}, 
	
	/*
	 * After all fixtures have been created, update the associations of each fixture for delayed dependencies.
	 */
	processMissingAssociations: function() {
		var updatePromises = [];
		
		_.each(associativeProcessing, function(fixture) {
			updatePromises = updatePromises.concat(fixture.updateAssociations());
		});
		
		return Q.all(updatePromises);
	}
};
	
// Helpers...
function getFileExtension(file) {
	return path.extname(file).toLowerCase();
}
	
function fileToModelName(file) {
	return path.basename(file).split('.')[0].toLowerCase();
}


/*
 * Fixture
 *
 * A module used to encapsulate functionality relating to a single fixture.
 * Aides in creation, validation and management of dependencies.
 *
 * @param {string} [modelName] The Sails.js entity this fixture represents.
 * @param {object} [data] Full JSON data from the fixture file.
 */
var Fixture = function(modelName, data) {
	this.modelName = modelName;
	this.data = data;
	this.dependencies = this.extractDependencies(data);
	this.associationId = data._associationId;
	delete data._associationId;
};
			
/*
 * Return an array of dependency information AND remove those attributes from the original fixture data.
 */
Fixture.prototype.extractDependencies = function(data) {
	var keys = Object.keys(data), 
			dependencies = [], 
			required, 
			type;
	
	_.each(keys, function(key) {
		if (_.isObject(data[key]) && data[key].hasOwnProperty('_association')) {
			type = 'collection';
			required = data[key]._required === true ? true : false;
			
			if (!_.isArray(data[key]._association)) {
				type = 'model';
				data[key]._association = [data[key]._association];
			}
				
			_.each(data[key]._association, function(associationId) {
				dependencies.push({ 
					property: key, 
					modelName: data[key]._model,
					associationId: associationId, 
					type: type, 
					required: required
				});
			});
			
			delete data[key];
		}
	});
	
	return dependencies;			
};

/*
 * Does this fixture have any dependencies that need to be resolved before creation.
 */
Fixture.prototype.hasRequiredDependencies = function() {
	var hasRequiredDependencies = false, 
			dependencies = this.dependencies;
	
	for (var i = 0; i < dependencies.length && !hasRequiredDependencies; i++) {
		if (dependencies[i].required === true) {
			hasRequiredDependencies = true;
		}
	}
	
	return hasRequiredDependencies;
};

/*
 * Does this fixture have any dependencies that need to be assigned after full fixture creation.
 */
Fixture.prototype.hasDelayedDependencies = function() {
	var hasDelayedDependencies = false, 
			dependencies = this.dependencies;
	
	for (var i = 0; i < dependencies.length && !hasDelayedDependencies; i++) {
		if (dependencies[i].required === false) {
			hasDelayedDependencies = true;
		}
	}
	
	return hasDelayedDependencies;
};

/*
 * Does this fixture have any relations at all.
 */
Fixture.prototype.isIndependent = function() {
	var isIndependent = false;	
	
	if (!this.hasRequiredDependencies() && !this.hasDelayedDependencies()) {
		isIndependent = true;	
	}
	
	return isIndependent;
};
		
/*
 * Check to see if any required dependencies have been resolved--to see if we can create.
 */
Fixture.prototype.requiredDependenciesAreResolved = function() {
	var isResolved = true, 
			dependencies = this.dependencies;
	
	if (this.hasRequiredDependencies()) {
		this.setRequiredDependencies();
		
		for (var i = 0; i < dependencies.length && isResolved; i++) {
			if (dependencies[i].required === true && !this.data[dependencies[i].property]) {
				isResolved = false;
			}
		}
	}
	
	return isResolved;
};

/*
 * Use the completed fixtures to fulfill the required dependencies
 */
Fixture.prototype.setRequiredDependencies = function() {
	var that = this;
	
	_.each(this.dependencies, function(dependency) {
		if (dependency.required === true) {
			completedFixtures[dependency.modelName] = completedFixtures[dependency.modelName] || [];
			that.data[dependency.property] = completedFixtures[dependency.modelName][dependency.associationId];	
		}
	});
};

/*
 * Return a clean version of the fixture--removed any sails-relational-fixture attributes.
 */
Fixture.prototype.toJSON = function() {
	return this.data;
};

/*
 * Save to database, updating required dependencies beforehand.
 */
Fixture.prototype.create = function() {
	var that = this, 
			promise, 
			fixtureData, 
			Model;

	if (!this.requiredDependenciesAreResolved()) {
		backlogSet.push(this);
	} else {
		Model = sails.models[this.modelName];

		this.setRequiredDependencies();
		fixtureData = this.toJSON();

		promise = Model.create(fixtureData)
			.then(function(result) {
				that.result = result;
				
				if (that.associationId) {
					completedFixtures[that.modelName] = completedFixtures[that.modelName] || [];
					completedFixtures[that.modelName][that.associationId] = result;
				}
			});
	}

	return promise;
};

/*
 * Evaluate dependencies and assign associations using an array of created fixtures.
 */
Fixture.prototype.updateAssociations = function() {
	var dependencyPromises = [], 
			model = this.result,
			that = this, 
			Model = sails.models[this.modelName];
	
	_.each(this.dependencies, function(dependency) {
		var association, 
				patch = {};
		
		if (dependency.required === false && completedFixtures[dependency.modelName] && _.isObject(completedFixtures[dependency.modelName][dependency.associationId])) {
			association = completedFixtures[dependency.modelName][dependency.associationId];

			switch(dependency.type) {
				case 'model':
					model[dependency.property] = association.id;
					break;
				case 'collection':
					model[dependency.property].add(association.id);
					break;
				default:
					throw new Error("Dependency requires type of model or collection to determine associative action.");
					break;
			}
		} else if (dependency.required === true && model[dependency.property] === null) {
			throw new Error("Unable to process dependency for model " + that.modelName + ' with property ' + dependency.property);
		}
	});
	
	dependencyPromises.push(model.save());
	
	return dependencyPromises;
};

module.exports = SailsFixtures;