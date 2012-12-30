/*global module, test, ok, strictEqual, equal, Backstage*/

module("Backstage.View");

test("Registering view classes", 3, function() {
  
  var TestView1 = Backstage.View.extend();
  var TestView2 = Backstage.View.extend();
  Backstage.registerViewClass('TestView2', TestView2);
  Backstage.registerViewClass('TestView1', TestView1);
  
  strictEqual(Backstage.getViewClass('TestView1'), TestView1, "Should return pointer to named view class.");
  strictEqual(Backstage.getViewClass('TestView2'), TestView2, "Should return pointer to named view class.");
  
  Backstage.unregisterViewClass('TestView2');
  ok(!Backstage.getViewClass('TestView2'));
  
});

test("Initialization", 4, function() {
  
  var isSet, TestView, view, target, template;

  strictEqual(Backstage.getViewClass('View'), Backstage.View, "Base View class is registered.");
  
  isSet = false;
  target = {};
  template = '<div></div>';
  
  TestView = Backstage.View.extend({

    target: target,
    template: template,
    
    initialize: function() {
      isSet = true;
    }
  });
  view = new TestView();
  
  strictEqual(isSet, true, "We have not disturbed a custom initialize() call.");
  strictEqual(view.target, target, "Initialization parameters are set on instance.");
  strictEqual(view.template, template, "Initialization parameters are set on instance.");

});

test("Child views", 5, function() {
  
  var didCallRemoveOnChild = false;
  var target = {};
  var view = new Backstage.View({ target: target });

  var childView = new Backstage.View({
    remove: function() {
      didCallRemoveOnChild = true;
    }
  });
  
  ok(view.childViews.length === 0, "Initialized with empty childViews array");
  
  view.addChildView(childView);
  strictEqual(view.childViews.length, 1, "View contains one child view");
  strictEqual(view.childViews[0], childView, "Child view is correct instance");
  strictEqual(childView.target, target, "Child view receives target pointer from parent");
  
  view.remove();
  strictEqual(didCallRemoveOnChild, true, "Calling remove() on parent also removes child views");
  
});

test("Rendering templates", function() {
  
  var view = new Backstage.View();
  
  view.render();
  ok(!view.$el.html(), "Simply renders an empty tag if template data is missing.");
  ok(_.isFunction(view.templateFunction), "Generates a Handlebars template function if one is not given.");
  
  view = new Backstage.View({
    templateFunction: Handlebars.compile('<p id="yes">Should use this template</p>'),
    template: '<div id="no">Should not use this template because pre-compiled template function is present</div>'
  });
  view.render();
  equal(view.$el.children()[0].id, "yes", "Should ignore template string if pre-compiled template function is present");
  
});

test("Watching attributes", 4, function() {

  var renderCount = 0;
  var model = new Backbone.Model();
  var view = new Backstage.View({
    model: model,
    watch: 'firstName lastName',
    
    render: function() {
      renderCount = renderCount + 1;
    }
  });
  
  strictEqual(renderCount, 0, "Has not rendered yet.");
  
  model.set('firstName', 'Amy');
  strictEqual(renderCount, 1, "Should re-render when watched attribute is changed.");
  
  model.set('lastName', 'Smith');
  strictEqual(renderCount, 2, "Should re-render when watched attribute is changed.");
  
  view.remove();
  model.set('firstName', 'Joe');
  strictEqual(renderCount, 2, "Should not re-render after view has been removed.");

});

test("Creating child views via template", 8, function() {

  var childViewB, childViewD;
  var template = '<span>{{#view tagName="ul" id="child-B" class="my-class-B"}}<li>{{#view tagName="a" id="child-D" className="my-class-D"}}text{{/view}}</li>{{/view}}</span>';
  var view = new Backstage.View({ template: template });
  view.render();

  equal(view.childViews.length, 1);
  equal(view.childViews[0].childViews.length, 1);
  
  childViewB = view.childViews[0];
  childViewD = view.childViews[0].childViews[0];

  strictEqual(view.$('span ul')[0], childViewB.$el[0], "Child of top-level view was created.");

  strictEqual(view.$('span ul li a')[0], childViewD.$el[0], "Child of child was created.");
  
  equal(view.$('span ul').attr('id'), 'child-B', "Added id attribute to outer child.");
  equal(view.$('span ul').attr('class'), 'my-class-B', "Added class attribute to outer child.");
  equal(view.$('span ul li a').attr('id'), 'child-D', "Added id attribute to inner child.");
  equal(view.$('span ul li a').attr('class'), 'my-class-D', "Added class attribute to inner child.");

});

test("Child view receives parent view model by default", function() {

  var template = '{{#view}}{{/view}}';
  var model = new Backbone.Model();
  var view = new Backstage.View({
    template: template,
    model: model
  });
 
  view.render();
  strictEqual(view.childViews[0].model, model, "Child view model should be parent view model.");

});

test("Optional string specifies child view type in template", function() {
  
  var TestView = Backstage.View.extend();
  var template = '{{#view "TestView"}}{{/view}}';
  var view = new Backstage.View({
    template: template
  });

  Backstage.registerViewClass('TestView', TestView);
  
  view.render();
  ok(view.childViews[0] instanceof TestView, "Child view should be of specified type.");

  Backstage.unregisterViewClass('TestView', TestView);
  
});

test("Specifying view model on child view via template", function() {

  var TestView = Backbone.View.extend({
    
    // for test purposes, expect model to be a string
    model: null

  });
  
  Backstage.registerViewClass('TestView', TestView);

  var model = new Backbone.Model({
    composer: "Bach"
  });

  var template = '{{#view "TestView" model=composer}}{{/view}}';
  var view = new Backstage.View({
    template: template,
    model: model
  });

  view.render();
  
  equal(view.childViews[0].model, model.get('composer'), "Child view model is value of specified parent model attribute");
  
  Backstage.unregisterViewClass('TestView'); // clean up

});

test("Specifying watched attributes on child view via template", function() {
  
  var model = new Backbone.Model({
    composer: "Bach",
    form: "Partita"
  });

  var template = '{{#view watch="composer form"}}<span id="composer">{{composer}}</span><span id="form">{{form}}</span>{{/view}}';

  var view = new Backstage.View({
    template: template,
    model: model
  });

  view.render();
  
  equal(view.$('span#composer').text(), "Bach", "Child view renders initial value.");
  equal(view.$('span#form').text(), "Partita", "Child view renders initial value.");
  
  model.set('composer', "Mozart");
  equal(view.$('span#composer').text(), "Mozart", "Child view re-renders with new value.");
  
  model.set('form', "Sonata");
  equal(view.$('span#form').text(), "Sonata", "Child view re-renders with new value.");

});

test("'class' attribute may be specified in template.", function() {

  var template = '{{#view class="sidebar left"}}{{/view}}';

  var view = new Backstage.View({
    template: template
  });
  
  view.render();
  
  ok(view.childViews[0].$el.hasClass('sidebar'), "The assigned class is present.");
  ok(view.childViews[0].$el.hasClass('left'), "The assigned class is present.");
  
});

test("'id' attribute may be assigned in template.", function() {

  var template = '{{#view id="my-view"}}{{/view}}';
  var view = new Backstage.View({ template: template });

  view.render();
  
  equal(view.childViews[0].$el.attr('id'), 'my-view', "View has the assigned id.");
  
});

test("Child view should always use preset template if present.", function() {
  
  var ChildView = Backstage.View.extend({
    template: '<b></b>'
  });
  
  Backstage.registerViewClass('ChildView', ChildView);
  
  var template = '{{#view "ChildView"}}<c></c>{{/view}}';
  var view = new Backstage.View({ template: template });

  view.render();
  
  ok(view.$('b').length === 1, "Child view rendered its preset template.");

  Backstage.unregisterViewClass('ChildView');
});

test("Child view always uses preset template function if present.", function() {

  var ChildView = Backstage.View.extend({
    template: '<b></b>',
    templateFunction: Handlebars.compile('<c></c>')
  });
  
  Backstage.registerViewClass('ChildView', ChildView);
  
  var template = '{{#view "ChildView"}}<d></d>{{/view}}';
  var view = new Backstage.View({ template: template });

  view.render();
  
  ok(view.$('c').length === 1, "Child view rendered its preset template function.");

  Backstage.unregisterViewClass('ChildView');
});

test("Child view always uses inline template when 'allowTemplateOverride' is true.", function() {

  var ChildView = Backstage.View.extend({
    template: '<b></b>',
    templateFunction: Handlebars.compile('<c></c>')
  });
  
  Backstage.registerViewClass('ChildView', ChildView);
  
  var template = '{{#view "ChildView" allowTemplateOverride=true}}<d></d>{{/view}}';
  var view = new Backstage.View({ template: template });

  view.render();
  
  ok(view.$('d').length === 1, "Child view rendered its assigned inline template.");

  Backstage.unregisterViewClass('ChildView');
});
