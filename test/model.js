/*global module, test, ok, strictEqual, equal, deepEqual, Backstage*/

module("Backstage.Model");

test("Model caches computed attribute names in static variable", function() {

  var Story = Backstage.Model.extend({
    
    fullName: Backstage.computedAttribute(),
    
    status: Backstage.computedAttribute()
    
  });

  ok(!Story.computedAttributeKeys, "Cache is not present until first instance is created.");

  var story = new Story();
  
  equal(Story.computedAttributeKeys.length, 2, "Cache is present after first instantiation.");
  ok(_.indexOf(Story.computedAttributeKeys, 'fullName') >= 0, "Cache now contains 'fullName'.");
  ok(_.indexOf(Story.computedAttributeKeys, 'status') >= 0, "Cache now contains 'status'.");
  
  story = null; // just use the variable so JSLint stops complaining
});

test("Model.createTemplateContext() without computed attributes", function() {
  var Story = Backstage.Model.extend({
    defaults: {
      testAttribute1: "A",
      testAttribute2: "B"
    }
  });

  var story = new Story();
  var context = story.createTemplateContext();
  
  deepEqual(context, story.attributes, "Should be simply the 'attributes' hash.");
  
});

test("Model.createTemplateContext() with computed and transform attributes", function() {
  var Author = Backbone.Model.extend();

  var Story = Backstage.Model.extend({
    defaults: {
      testAttribute1: "A",
      testAttribute2: "B",
      author: {
        name: "Kurt Vonnegut"
      }
    },
    
    computedAttribute1: Backstage.computedAttribute()
      .get(function() {
        return "C";
      }),

    computedAttribute2: Backstage.computedAttribute()
      .get(function() {
        return "D";
      }),
      
    author: Backstage.transformAttribute(Author)
  });

  var story = new Story();
  var context = story.createTemplateContext();
  
  _.each(context, function(value, key) {
    equal(value, story.get(key), "Context contains value from model.");
  });
  
});

test("Model transform attribute", function() {
  
  var Author = Backbone.Model.extend();

  var Story = Backstage.Model.extend({
    author: Backstage.transformAttribute(Author)
  });

  var story = new Story({
    author: {
      name: "James Taylor"
    }
  });
  
  ok(story.get('author') instanceof Author, "Attribute instantiates proper child model type.");
  deepEqual(story.get('author').toJSON(), story.toJSON().author, "Created model contains same attributes as parent.");
  
  story.set('author', {
    name: "William Shakespeare"
  });
  
  deepEqual(story.get('author').toJSON(), story.toJSON().author, "Setting hash to transform property sets child model.");
  
  story.get('author').set('name', "J.R.R. Tolkien");
  deepEqual(story.get('author').toJSON(), story.toJSON().author, "Setting attribute on model sets hash on parent model.");
  
  var jefferson = new Author({
    name: "Thomas Jefferson"
  });

  story.set('author', jefferson);
  
  ok(story.get('author') !== jefferson, "'author' does not point to new model.");
  deepEqual(story.attributes.author, jefferson.attributes, "Attributes of new model have been copied to parent.");

});

test("Collection transform attribute", function() {

  var temp;

  var Chapter = Backbone.Model.extend();
  var ChapterCollection = Backbone.Collection.extend({
    model: Chapter
  });
  
  var Story = Backstage.Model.extend({
    chapters: Backstage.transformAttribute(ChapterCollection)
  });
  
  var story = new Story({
    chapters: [
      {
        name: "A Cold Morning",
        pages: 10
      },
      {
        name: "When the Fog Lifted",
        pages: 20
      }
    ]
  });

  ok(story.get('chapters') instanceof ChapterCollection);
  deepEqual(story.get('chapters').toJSON(), story.attributes.chapters);

  temp = story.attributes.chapters;
  story.get('chapters').reset();
  equal(story.attributes.chapters.length, 0, "Clearing the collection contents clears the array on the owning model too.");
  
  story.get('chapters').reset(temp);
  deepEqual(story.attributes.chapters, story.get('chapters').toJSON());

});

test("Computed attributes", function() {
  
  var didNotify;
  
  var Author = Backstage.Model.extend({

    defaults: {
       firstName: "Jack",
       lastName: "London"
    },

    fullName: Backstage.computedAttribute()
      .get(function(key) {
        return this.get('firstName') + " " + this.get('lastName');
      })
      .set(function(key, value, options) {
        var names = _.isString(value) ? value.split(' ') : ["", ""];

        this.set({
          firstName: names[0],
          lastName: names[1]
        });
      })
      .dependsOn('firstName', 'lastName'),
      
    upperCaseFullName: Backstage.computedAttribute()
      .get(function(key) {
        return this.get('fullName').toUpperCase();
      })
      .dependsOn('fullName')

  });
  
  var author = new Author();
  
  equal(author.get('fullName'), "Jack London");
  
  author.set('fullName', "Jane Austen");
  equal(author.get('firstName'), "Jane");
  equal(author.get('lastName'), "Austen");
  
  didNotify = false;
  author.on('change:fullName', function() {
    didNotify = true;
  });
  
  author.set('firstName', "Mary");
  ok(didNotify);

});

test("'model' Handlebars block helper", function() {

  var ModelA = Backbone.Model.extend({
    defaults: {
      name: 'A'
    }
  });
  
  var ModelB = Backbone.Model.extend({
    defaults: {
      name: 'B'
    }
  });
  
  var modelB = new ModelB();
  Backstage.registerModel('modelB', modelB);

  var testView = new Backstage.View({
    template: '<span id="model-a-first">{{name}}</span>{{#model "modelB"}}<span id="model-b">{{name}}</span>{{/model}}<span id="model-a-last">{{name}}</span>',
    model: new ModelA()
  });

  testView.render();
  
  equal(testView.$('span#model-a-first').text(), 'A');
  equal(testView.$('span#model-b').text(), 'B');
  equal(testView.$('span#model-a-last').text(), 'A');
  
});
