/*global module, test, ok, strictEqual, equal, Backstage*/

module("Backstage.CollectionView");

test("CollectionView is a registered view class.", function() {

  strictEqual(Backstage.getViewClass('CollectionView'), Backstage.CollectionView, "CollectionView has been registered.");
  
});

test("Works without a model.", function() {
  
  var view = new Backstage.CollectionView();
  view.render();
  
  ok(!view.$el.html(), "Simply renders empty element.");
  
});

test("Renders a collection.", function() {

  var TestModel = Backbone.Model.extend();
  var TestCollection = Backbone.Collection.extend({ model: TestModel });
  
  var collectionView, collection;

  var checkChildViews = function() {
    equal(collectionView.childViews.length, collection.length, "View has as many child views as collection has models.");
    
    collection.forEach(function(item, index) {
      strictEqual(collectionView.childViews[index].model, item, "Child view represents correct model in the collection.");
    });
  };
  
  collection = new TestCollection();
  collectionView = new Backstage.CollectionView({ model: collection });
  
  collectionView.render();
  checkChildViews();
  
  collection.reset([
    {
      id: '1'
    },
    {
      id: '2'
    }
  ]);
  checkChildViews();

  collection.add({ id: '0' }, { at: 0 });
  checkChildViews();

  collection.add({ id: '3' });
  checkChildViews();
  
  collection.remove(collection.get('1'));
  checkChildViews();

  collection.add({ id: '4'}, { at: 1 });
  checkChildViews();

  collection.reset();
  checkChildViews();

});

test("Uses View class as default child view class.", function() {

  var TestModel = Backbone.Model.extend();
  var TestCollection = Backbone.Collection.extend({ model: TestModel });
  var collectionView, collection;

  collection = new TestCollection([{ id: '1' }]);
  collectionView = new Backstage.CollectionView({ model: collection });
  
  collectionView.render();
  ok(collectionView.childViews[0] instanceof Backstage.View);
  
});

test("Uses specified 'itemViewClass' and 'itemViewTagName' for child views if present.", function() {

  var TestModel = Backbone.Model.extend();
  var TestCollection = Backbone.Collection.extend({ model: TestModel });
  var ItemViewClass = Backstage.View.extend();
  var collectionView, collection;

  collection = new TestCollection([{ id: '1' }]);
  collectionView = new Backstage.CollectionView({
    model: collection,
    itemViewClass: ItemViewClass,
    itemViewTagName: 'span'
  });
  
  collectionView.render();
  ok(collectionView.childViews[0] instanceof ItemViewClass, "Child view is instance of specified class.");
  equal(collectionView.childViews[0].$el[0].tagName.toLowerCase(), 'span', "Child view uses specified tag name.");
  
});

test("'itemViewClass' may be a string name.", function() {

  var TestModel = Backbone.Model.extend();
  var TestCollection = Backbone.Collection.extend({ model: TestModel });
  var ItemView = Backstage.View.extend();
  var collectionView, collection;

  Backstage.registerViewClass('ItemView', ItemView);

  collection = new TestCollection([{ id: '1' }]);
  collectionView = new Backstage.CollectionView({
    model: collection,
    itemViewClass: 'ItemView',
    itemViewTagName: 'span'
  });
  
  collectionView.render();
  ok(collectionView.childViews[0] instanceof ItemView, "Child view is instance of specified class.");

  Backstage.unregisterViewClass('ItemView');
  
});

test("Inline template gets passed to child views.", function() {

  var TestModel = Backbone.Model.extend();
  var TestCollection = Backbone.Collection.extend({ model: TestModel });
  var collectionView, collection;
  var template = '<ul><li></li></ul>';

  collection = new TestCollection([{ id: '1' }, { id: '2' }]);
  collectionView = new Backstage.CollectionView({
    template: template,
    model: collection
  });
  
  collectionView.render();
  _.each(collectionView.childViews, function(childView) {
    equal(childView.$('ul li').length, 1, "Inline template has been passed to child view.");
  });

});

test("'collection' Handlebars block helper", function() {

  var TestModel = Backbone.Model.extend();
  var TestCollection = Backbone.Collection.extend({ model: TestModel });
  var model = new Backbone.Model();
  var collection = new TestCollection({ model: TestModel });
  var view;
  
  model.set('testCollection', collection);

  view = new Backstage.View({
    template: '{{#collection testCollection}}{{/collection}}',
    model: model
  });
  
  view.render();
  
  ok(view.childViews[0] instanceof Backstage.CollectionView, "'collection' block helper creates a CollectionView.");
  strictEqual(view.childViews[0].model, collection, "Collection gets passed to CollectionView as 'model' property.");
  
});
