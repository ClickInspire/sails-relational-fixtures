# Database fixtures for Sails.js

[![Build Status](https://travis-ci.org/ClickInspire/sails-relational-fixtures.png?branch=master)](https://travis-ci.org/ClickInspire/sails-relational-fixtures)
[![Dependency Status](https://gemnasium.com/ClickInspire/sails-relational-fixtures.png)](https://gemnasium.com/ClickInspire/sails-relational-fixtures)

## Installation

`$ npm install sails-relational-fixtures`

or add the module to your `package.json` and run

`$ npm install`

## Usage

Drop your fixtures in `test/fixtures` as JSON files named after your models.

Once your [Sails.js](http://sailsjs.org/) server is started:

    var fixtures = require('sails-relational-fixtures'), 
			data = fixtures.load().objects;
				
		fixtures.populate(function(err) {
			...
		});


After `load` the fixture data will be accessible via the `objects` property.

`Populate`'ing the test database involves two steps:

* Removing any existing data from the collection corresponding to the fixture
* Loading the fixture data into the database

## Associating models

Occasionally fixutres may require associations, typically more common in tests.

`sails-fixtures` has special parameters reserved to identify and associate objects as they are created.

### Identification

To identify a fixture within your own `text/fixtures` files, assign a number to the field `_associationId` on any object. For example:

	[{
		"_associationId": 1, 
		"name": "Apple"
	}, {
		"_associationId": 2, 
		"name": "Orange"
	}]
	
These `_associationId`s are not required and do not have to be in order. They will be used as a reference for any objects that require these entities.

**NOTE:** `_associationId` is unique to a model. Meaning you can use an `_associationId` of 1 in multiple fixture `.json` files, just not in the same file more than once.

### Loose Association

A loose association is one that is not required at the time of model creation. All fixtures without required associations will be updated with their associations after all of the model creation has been completed.

To associate an object, using the `_associationId` supplied above, use our model notation. This works both for single models:

	"favouriteFruit": {
	  "_association": 2,
		"_model": "fruit"
	}
		
And collections:

	"availableFruit": {
		"_association": [1, 2], 
		"_model": "fruit"
	}
	
Note that the `_model` attribute references the Sails.js entity that the association references.

### Required Associations

If your model requires that an association be in place upon creation, you can do so by adding the parameter `_required`:

	"favouriteFruit": {
	  "_association": 2,
		"_model": "fruit", 
		"_required": true
	}
	
*`sails-relational-fixtures` does not yet support required collections. If there are any circular dependencies, `sails-relational-fixtures` will throw an error.*

## License

[The MIT License](http://opensource.org/licenses/MIT)

Copyright (c) 2014 [Matt Doak](http://spotopen.ca/)

Inspired by [Ruslan Bredikhin](http://ruslanbredikhin.com/) in [Barrels](https://github.com/bredikhin/barrels/)