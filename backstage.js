// Backstage.js v0.1
//
// (c) 2012 Jonathan Lewis
// Backstage.js may be freely distributed under the MIT license.
//
// A javascript library built on Backbone.js that provides easy
// auto-creation of Backbone views via Handlebars templates, along
// with computed and transform attributes for Backbone models, and
// a CollectionView for rendering Backbone collections.
//
// Dependencies:
//   Underscore.js
//   Backbone.js (v0.9.9 or greater)
//   Handlebars.js
//   jQuery.js
//

(function() {

  var root = this;
  var Backstage, Model, ComputedAttribute, TransformAttribute, View, CollectionView;
  
  var viewClasses, registerViewClass, getViewClass, viewBlockHelper;
  var models, getModel, controllers, getController;

  var createTemplateContext;

  var viewStack, pushView, peekView, popView;
  var modelStack, pushModel, peekModel, popModel;

  var ID_ATTRIBUTE = 'data-backstage-id';
  var splitter = /\s+/;

  
  Backstage = root.Backstage = {};


  // Computed Attribute
  // ------------------
  //
  // Defines an object used internally to keep track of computed attributes.

  Backstage.ComputedAttribute = ComputedAttribute = function() {};

  _.extend(ComputedAttribute.prototype, {

    dependsOnAttributes: null,

    // Used to attach a custom getter function 'func' to this
    // computed attribute if desired.
    get: function(func) {
      this.getter = func;
      return this;
    },

    // Used to attach a custom setter function 'func' to this
    // computed attribute if desired.
    set: function(func) {
      this.setter = func;
      return this;
    },

    // A reference to this attribute's getter function.
    // Default does nothing in case not specified
    getter: function() { return undefined; },

    // A reference to this attribute's setter function.
    // Default noop in case not specified.
    setter: function(key, value, options) {},

    // Optional; used to declare the other attributes that this
    // attribute depends on.  Should be comma-separated attribute
    // name strings.  Any attributes listed here will trigger
    // recomputation of this attribute when changed.
    dependsOn: function() {
      this.dependsOnAttributes = Array.prototype.slice.call(arguments, 0);
      return this;
    }

  });
  
  // Use this to declare a computed attribute in your model class:
  //
  //   var MyModel = Backstage.Model.extend({
  //     
  //     fullName: Backstage.computedAttribute()
  //       .get(function(key) { // your custom getter function
  //         return this.get('firstName') + ' ' + this.get('lastName');
  //       })
  //       .set(function(key, value, options) { // your custom setter function
  //         var names = value.split(' '); // yes it's unsafe, but just to give you the idea...
  //         this.set({ firstName: names[0], lastName: names[1] });
  //       })
  //       .dependsOn('firstName', 'lastName')
  //   });
  //
  // Note that this usage shares the newly created ComputedAttribute object
  // among all instances of a particular model type, per computed attribute.
  Backstage.computedAttribute = function() {
    return new ComputedAttribute();
  };


  // Transform Attribute
  // -------------------
  //
  // Defines an object used internally to keep track of computed attributes.

  Backstage.TransformAttribute = TransformAttribute = function(attrs) {
    _.extend(this, attrs);
  };
  
  _.extend(TransformAttribute.prototype, {
    
    // Pointer to a Backbone Model or Collection class
    model: null
    
  });

  // Use this to declare a transform attribute in your model class. It must
  // share the name of the model's attribute that it is transforming. For example:
  //
  //   Suppose a preexisting model class "Author":
  //
  //     var Author = Backbone.Model.extend({
  //       defaults: { name: "William Shakespeare" }
  //     });
  //
  //   You can now define another model in terms of Author:
  //
  //     var Script = Backstage.Model.extend({
  //
  //       defaults: {
  //         author: { name: "William Shakespeare" }
  //       },
  //
  //       author: Backstage.transformAttribute(Author)
  //
  //     });
  //
  //     var myScript = new Script();
  //     var author = myScript.get('author'); // returns an Author instance containing { name: "William Shakespeare" }
  //     author.set('name', "John King"); // sets 'name' inside both the 'author' model and 'myScript'.
  //
  Backstage.transformAttribute = Backstage.transform = function(model) {
    return new TransformAttribute({
      model: model
    });
  };


  // Model Class
  // -----------
  //
  // Declares a model class that extends Backbone.Model, adding support for
  // computed and transform attributes.
  
  Backstage.Model = Model = Backbone.Model.extend({

    // PUBLIC METHODS

    constructor: function(options) {
      this._isSettingTransformAttribute = {};
      this._transformAttributeModels = {};

      this._attributeIsInvalid = {};
      this._invalidAttributeKeys = [];

      this._initComputedAttributes();
      
      Backbone.Model.apply(this, arguments); // call super class constructor
    },

    // Returns a hash that should be used as the Handlebars template context when
    // rendering this model.
    // By default it collects the model's basic, computed, and transform attribute values.
    // Override this to pass a custom hash to a Handlebars template.
    createTemplateContext: function() {
      var computedAttributes = _.reduce(this.getComputedAttributeKeys(), function(memo, key) {
        memo[key] = this.get(key);
        return memo;
      }, {}, this);
      
      var transformAttributes = _.reduce(this.getTransformAttributeKeys(), function(memo, key) {
        memo[key] = this.get(key);
        return memo;
      }, {}, this);

      return _.extend({}, this.attributes, computedAttributes, transformAttributes);
    },

    get: function(attr) {
      var value;

      if (this[attr] instanceof ComputedAttribute) {
        value = this[attr].getter.apply(this, arguments);
      }
      else if (this[attr] instanceof TransformAttribute) {
        value = this.getTransformAttributeModel(attr, true);
      }
      else {  
        value = Backbone.Model.prototype.get.apply(this, arguments);
      }
      
      return value;
    },

    set: function(key, value, options) {
      var attrs, attr, isSettingSpecialAttribute = false;

      // standardize params
      if (_.isObject(key) || key === null) {
        attrs = key;
        options = value;
      }
      else {
        attrs = {};
        attrs[key] = value;
      }

      // See if we have any computed or transform attributes. If not, we can avoid
      // triggering multiple 'change' events by simply passing the whole of 'attrs'
      // to the original Model.set() method.
      for (attr in attrs) {
        if ((this[attr] instanceof ComputedAttribute) || (this[attr] instanceof TransformAttribute)) {
          isSettingSpecialAttribute = true;
          break;
        }
      }

      if (isSettingSpecialAttribute) {
        for (attr in attrs) {
          value = attrs[attr];

          if (this[attr] instanceof ComputedAttribute) {
            this[attr].setter.call(this, attr, value, options);
          }
          else if (this[attr] instanceof TransformAttribute) {
            if (!this._isSettingTransformAttribute[attr]) {
              this._isSettingTransformAttribute[attr] = true;

              if (value instanceof Backbone.Model) { // allow value to be a model; we'll copy its attributes
                value = value.toJSON();
              }

              Backbone.Model.prototype.set.call(this, attr, value, options);
              this.setTransformAttributeModel(attr, value, options); // set the same value on the linked model instance

              this._isSettingTransformAttribute[attr] = false;
            }
          }
          else { // standard attribute, so call super class set() method
            Backbone.Model.prototype.set.call(this, attr, value, options);
          }

          // Computed attributes might depend on this attribute. If so, invalidate them.
          this._invalidateDependentAttributes(attr);
        }
      }
      else { // no special attributes, so just call the super class set() to avoid firing multiple 'change' events where possible
        Backbone.Model.prototype.set.call(this, attrs, options);

        // Since other special attributes might depend on these, we still need
        // to check for invalidation
        for (attr in attrs) {
          this._invalidateDependentAttributes(attr);
        }
      }

      this._notifyInvalidAttributes(options);

      return this;
    },

    // Returns a cached array of the attribute names defined on the class
    // as computed attributes.
    getComputedAttributeKeys: function() {
      var keys = this.constructor.computedAttributeKeys; // stored as static variable on class
      var key;

      if (!keys) { // compute once per class and cache
        keys = [];
        
        for (key in this) {
          if (this[key] instanceof ComputedAttribute) {
            keys.push(key);
          }
        }

        this.constructor.computedAttributeKeys = keys;
      }
      
      return keys;
    },

    // Returns a cached array of the attribute names defined on the class
    // as transform attributes.
    getTransformAttributeKeys: function() {
      var keys = this.constructor.transformAttributeKeys;
      var key;
      
      if (!keys) { // compute once per class and cache
        keys = [];
        
        for (key in this) {
          if (this[key] instanceof TransformAttribute) {
            keys.push(key);
          }
        }

        this.constructor.transformAttributeKeys = keys;
      }
      
      return keys;
    },

    // Returns the model instance created by a transform attribute 'attr'.
    // If it hasn't been created yet (via a get() call), returns undefined.
    // Can force creation of the model if needed by setting 'shouldCreateIfNeeded' to true.
    getTransformAttributeModel: function(attr, shouldCreateIfNeeded) {
      if (!this._transformAttributeModels[attr] && shouldCreateIfNeeded) {
        Model = this[attr].model;
        this._transformAttributeModels[attr] = new Model(this.attributes[attr]);
        this._attachTransformAttributeListener(attr, this._transformAttributeModels[attr]);
      }

      return this._transformAttributeModels[attr];
    },

    setTransformAttributeModel: function(attr, value, options) {
      var model = this.getTransformAttributeModel(attr, false); // don't create it if no one is asking for it

      if (model) {
        if (model instanceof Backbone.Collection) {
          model.reset(value, options);
        }
        else {
          model.set(value, options);
        }
      }
    },

    // PRIVATE METHODS

    // Only actually performs work once per model class. Constructs an index of
    // attribute dependencies.
    _initComputedAttributes: function() {
      var keys, addDependents, key, i, dependents;

      if (!this.constructor.attributeDependents) { // cached as static variable on class
        keys = this.getComputedAttributeKeys(); // uses cache if present
        this.constructor.attributeDependents = dependents = {}; // cache this result so we only compute the dependency tree once per model class

        addDependents = function(attr) {
          if (!dependents[attr]) {
            dependents[attr] = [];
          }

          dependents[attr].push(key);
        };

        for (i = 0; i < keys.length; i = i + 1) {
          key = keys[i];
          _.each(this[key].dependsOnAttributes, addDependents, this);
        }
      }
    },

    // Recursively invalidates computed attributes that depend
    // on changed attributes
    _invalidateDependentAttributes: function(attr) {
      var attrs = this.constructor.attributeDependents[attr];
      var i;

      if (attrs) {
        for (i = 0; i < attrs.length; i = i + 1) {
          if (!this._attributeIsInvalid[attrs[i]]) {
            this._attributeIsInvalid[attrs[i]] = true; // mark it as invalid so we only notify once for this attribute
            this._invalidAttributeKeys.push(attrs[i]); // push it onto the list of invalid keys
            this._invalidateDependentAttributes(attrs[i]); // recurse since other attributes might depend on this one
          }
        }
      }
    },

    // triggers 'change:' events for each computed attribute whose
    // dependencies have changed.
    _notifyInvalidAttributes: function(options) {
      var attr;
      var didChange = this._invalidAttributeKeys.length > 0;

      if (!options || !options.silent) {
        while (this._invalidAttributeKeys.length > 0) {
          attr = this._invalidAttributeKeys.shift();
          this._attributeIsInvalid[attr] = false;
          this.trigger('change:' + attr, this, this.get(attr), options);
        }

        if (didChange) { // if at least one has changed, fire the general 'change' event too
          this.trigger('change', this, options);
        }
      }
      else { // we're not going to notify, so forget that anything was invalid
        this._invalidAttributeKeys = [];
        this._attributeIsInvalid = {};
      }
    },

    // attaches an event listener to a transform attribute's model so that
    // we can pass model changes back to the parent model also, keeping them
    // in sync.
    _attachTransformAttributeListener: function(key, model) {
      this.listenTo(model, (model instanceof Backbone.Collection) ? 'reset sort add remove' : 'change', function() {
        // closure keeps proper values in 'key' and 'model'
        if (!this._isSettingTransformAttribute[key]) { // prevent infinite looping
          this.set(key, model.toJSON());
        }
      }, this);
    },

    // PRIVATE PROPERTIES
    
    _computedAttributeIsValid: null,
    _transformAttributeModels: null,
    _isSettingTransformAttribute: null

  });

  
  // Template context helper function
  // ---------------------------------
  //
  // Given a model, create a Handlebars template function
  // rendering context hash. If 'model' is null, returns null.
  
  createTemplateContext = function(model) {
    var context = null;

    if (model) {
      if (_.isFunction(model.createTemplateContext)) { // first see if the model knows how to create the context itself
        context = model.createTemplateContext();
      }
      else if (_.isFunction(model.toJSON)) { // otherwise, it might be a basic Backbone.Model, so just use it's attributes
        context = model.toJSON();
      }
      else { // as a fallback (in case model is just a hash, for example), just pass it through
        context = model;
      }
    }

    return context;
  };


  // Rendering Context Stacks
  // ------------------------

  // Every time a Backstage.View is rendered, it pushes itself onto
  // this stack and becomes the "current view", and the parent view
  // of any views created by its template.  After rendering, the
  // view pops itself back off this stack.
  //
  // At any time, code may call Backstage.peekView() to get a reference
  // to the current view.

  viewStack = [];
  
  Backstage.pushView = pushView = function(view) {
    viewStack.push(view);
  };
  
  Backstage.peekView = peekView = function() {
    return viewStack[viewStack.length - 1];
  };
  
  Backstage.popView = popView = function() {
    return viewStack.pop();
  };

  // Every time a Backstage.View is rendered, it pushes its model
  // onto this stack, and pops it back off when it is finished.
  // Also, whenever a {{#model}}...{{/model}} or {{#controller}}...{{/controller}}
  // block is encountered in a template, the referenced model gets
  // pushed onto this stack for the duration of the block.
  //
  // At any time, the current model considered "in context" may be
  // accessed by calling Backstage.peekModel().

  modelStack = [];
  
  Backstage.pushModel = pushModel = function(model) {
    modelStack.push(model);
  };
  
  Backstage.peekModel = peekModel = function() {
    return modelStack[modelStack.length - 1];
  };
  
  Backstage.popModel = popModel = function() {
    return modelStack.pop();
  };

  
  // Model Registry
  // --------------
  //
  // Use this to register particular stand-alone model instances
  // that you want to refer to later via {{#model "[name]"}}...{{/model}}
  // template blocks.
  
  models = {};
  
  Backstage.registerModel = function(name, model) {
    models[name] = model;
  };

  Backstage.unregisterModel = function(name) {
    delete models[name];
  };
  
  Backstage.getModel = getModel = function(name) {
    return models[name];
  };
  
  
  // Controller Registry
  // -------------------
  //
  // Use this to register constroller instances that you want to
  // refer to later via {{#controller "[name]"}}...{{/controller}}
  // template block.
  
  controllers = {};
  
  Backstage.registerController = function(name, controller) {
    controllers[name] = controller;
  };
  
  Backstage.unregisterController = function(name) {
    delete controllers[name];
  };
  
  Backstage.getController = getController = function(name) {
    return controllers[name];
  };
  

  // Model Handlebars Helper
  // -----------------------
  //
  // This template block helper changes the Handlebars rendering
  // context to the model specified, for the duration of the block.
  
  Handlebars.registerHelper('model', function(model, options) {
    var context,  html;

    model = _.isString(model) ? getModel(model) : model;
    context = createTemplateContext(model);
    
    pushModel(model); // push this model onto the stack
    html = options.fn(context); // render using this model's attributes as context
    popModel(); // pop the model off the stack after rendering this block

    return html;
  });


  // Controller Handlebars Helper
  // ----------------------------
  //
  // This template block helper changes the current Handlebars rendering context
  // to the model returned by the referenced controller's getModel() method, for
  // the duration of the block.

  Handlebars.registerHelper('controller', function(controller, options) {
    var context, html, model;
    
    controller = _.isString(controller) ? getController(controller) : controller;
    model = controller ? controller.getModel() : null;
    context = createTemplateContext(model);
  
    pushModel(model); // push the controller's model onto the stack
    html = options.fn(context); // render template using the model's context
    popModel(); // pop the model off the stack after we've rendered this block

    return html;
  });


  // View Class Registry
  // -------------------
  //
  // This allows you to specify in a template which view class should be used to render
  // a given {{#view}}...{{/view}} template block.  To use anything other than the default
  // Backstage.View class, register your view class here by calling:
  //
  //   Backstage.registerViewClass("MyView", MyViewClass);
  //
  // Then you can refer to it in a template like this:
  //
  //   ...  {{#view "MyView"}}...{{/view}} ...
  //
  // and when that portion of your template is rendered, an instance of MyViewClass will
  // be created and passed the contents of the {{#view}} block to render.
  
  viewClasses = {};

  Backstage.registerViewClass = registerViewClass = function(className, ViewClass) {
    viewClasses[className] = ViewClass;
  };
  
  Backstage.unregisterViewClass = function(className) {
    delete viewClasses[className];
  };
  
  Backstage.getViewClass = getViewClass = function(className) {
    return viewClasses[className];
  };


  // Backstage.View
  // --------------
  //
  // Defines the base view class that supports auto-creation
  // of child views as specified in the view's Handlebars template.

  Backstage.View = View = Backbone.View.extend({
    
    // PUBLIC PROPERTIES
    
    // Optional. A convenience pointer to an object implementing Backbone.Events,
    // on which events can be triggered, in response to clicks on this
    // view, for example.
    //
    // This reference will also be passed to any child views, if they
    // don't already have a target set.
    //
    // An example usage might be to pass in Backbone itself, if you're using
    // that as a global events bus.
    target: Backbone,
    
    // Optional. A Handlebars template string to be rendered as the contents
    // of this view. Used to compile a Handlebars template function if 'templateFunction'
    // below is not set.
    template: null,
    
    // Optional. A compiled Handlebars template. If this view is an auto-created child
    // view corresponding to a {{#view}}...{{/view}} block, this will always be set to
    // the Handlebars block helper 'options.fn' and will contain the template fragment
    // within the block, as long as 'template' and 'templateFunction' are not previously set,
    // or if 'allowTemplateOverride' below is true.
    templateFunction: null,

    // Set this to true if the contents of a {{#view}}...{{/view}} block should override 
    // whatever is already in 'template' or 'templateFunction', when this view is auto-created
    // as a child view.  Note that this means the template will always be overridden when true,
    // even if by an empty template block.
    // 
    // The normal way to do this is to simply leave this false, leave 'template' and 'templateFunction'
    // blank, and let the template block dictate this view's content.  But this option is
    // provided in case you have a specific view class that always contains its own template,
    // and you'll be ignoring any view block content.
    allowTemplateOverride: false,
    
    // Optional. A string of space-separated attribute names on the model whose changes
    // will trigger a re-render of this view.
    watch: null,
    
    // Optional. A string of space-separated events on 'model' that will trigger a re-render of this view.
    watchEvents: null,
    
    // Generally read-only, unless you specifically need to manage them. An array
    // of this view's auto-created child views.
    childViews: null,
    
    // PUBLIC METHODS

    constructor: function(options) {
      var toWatch;

      // Call the parent class' constructor
      Backbone.View.apply(this, arguments);

      // Now do our own constructor work
      this.childViews = [];

      _.extend(this, options);
      
      if (this.model) { // assumes if watch attributes are specified, model supports events
        toWatch = _.isString(this.watch) ? this.watch.split(splitter) : this.watch;

        _.each(toWatch, function(key) {
          this.listenTo(this.model, 'change:' + key, this.render, this);
        }, this);
        
        if (this.watchEvents) {
          this.listenTo(this.model, this.watchEvents, this.render, this);
        }
      }
    },

    // Same as remove().
    // Cleans up this view's event listeners and along with all child views.
    destroy: function() {
      return this.remove();
    },
    
    // Override the standard remove() function so we can cascade
    // through our automatically-created child views and clean them up too.
    remove: function() {
      Backbone.View.prototype.remove.apply(this, arguments); // call the superior function first; calls this.stopListening() for us.
      this.removeChildViews();
      return this;
    },

    addChildView: function(childView) {
      return this.insertChildViewAt(childView);
    },

    insertChildViewAt: function(childView, index) {
      this.childViews.splice(_.isNumber(index) ? index : this.childViews.length, 0, childView);
      
      if (!childView.target) {
        childView.target = this.target;
      }
      
      return this;
    },

    removeChildViewAt: function(index) {
      var childView = this.childViews[index];
      this.childViews.splice(index, 1);
      childView.remove();
    },

    removeChildViews: function() {
      _.invoke(this.childViews, 'remove');
      this.childViews = [];
    },
    
    // Override this to define a custom context that'll get
    // passed to the Handlebars template.  It should return a hash
    // of values referenced in the template.
    createTemplateContext: function() {
      return createTemplateContext(this.model);
    },
    
    // Render this view's template content.
    renderTemplate: function() {
      var html;

      // Clean up any existing content
      this.$el.empty();
      this.removeChildViews();
      
      // compile and cache this view's template string if necessary
      if (!this.templateFunction) {
        this.templateFunction = Handlebars.compile(this.template || '');
      }

      // render the template to html and append it to this view's DOM element
      html = this.templateFunction(this.createTemplateContext());
      this.$el.append(html);

      return this;
    },

    // Finds each child view's placeholder tag and replaces it with the child view's
    // own rendered element.  These placeholder tags will have been placed by
    // Backstage.viewBlockHelper().
    renderChildViews: function() {
      _.each(this.childViews, function(childView) {
        this.$('[' + ID_ATTRIBUTE + '=\"' + childView.cid + '\"]').replaceWith(childView.render().$el);
      }, this);

      return this;
    },
    
    beginRender: function() {
      pushView(this);
      pushModel(this.model);
    },

    render: function() {
      this.beginRender();
      this.renderTemplate();
      this.renderChildViews();
      this.endRender();
      return this;
    },
    
    endRender: function() {
      popModel();
      popView();
    }

  });

  // Register the Backstage.View base class under the name 'View'
  registerViewClass('View', View);
  
  // This function will be used as a Handlebars helper for {{#view}}...{{/view}} template blocks.
  Backstage.viewBlockHelper = viewBlockHelper = function(className, options) {
    var ViewClass, view, attrs, parentView;

    attrs = _.clone(options.hash); // we'll pass the hash into the new view
    parentView = peekView(); // parent view will be the current view on the stack

    if (!attrs.model) {
      attrs.model = peekModel(); // if model property isn't set explicitly, use the model currently on the stack
    }

    // copy these special attributes over
    attrs.attributes = {
      'class': attrs['class'],
      id: attrs.id
    };

    // Create the new view
    ViewClass = getViewClass(className) || View;
    view = new ViewClass(attrs);
    //view.$el.attr(ID_ATTRIBUTE, view.cid);
    
    // Give the view its template function, unless it already has something.
    if (view.allowTemplateOverride || (!view.template && !view.templateFunction)) {
      view.templateFunction = options.fn;
    }

    parentView.addChildView(view);

    // Return an identifiable placeholder tag that we'll replace from within the parent view.
    return ['<', view.tagName, ' ', ID_ATTRIBUTE, '=\"', view.cid, '\"></', view.tagName, '>'].join('');
  };

  // Register the view block helper with Handlebars.
  Handlebars.registerHelper('view', function(className, options) {
    // 'className' param may be omitted, in which case the base
    // View class will be assumed.
    if (!_.isString(className)) {
      options = className;
      className = 'View';
    }
    
    return viewBlockHelper(className, options);
  });


  // CollectionView Class
  // --------------------
  //
  // A view designed to receive a Backbone.Collection instance
  // as its model.  It will generate one child view per collection
  // item, passing the item to the child view as its model, and
  // the collection view's template as the child view's template.
   
  Backstage.CollectionView = CollectionView = View.extend({

    // PUBLIC PROPERTIES
    
    // May be a string name used to register a view class, or a pointer to
    // the view class itself.
    itemViewClass: View,
    
    // Optional. Will set the 'tagName' property on each child view.
    itemViewTagName: null,

    // PUBLIC METHODS
    
    constructor: function(options) {
      View.apply(this, arguments); // call parent class constructor
      
      this._itemViewIndex = {};
      
      if (this.model) {
        this.listenTo(this.model, 'reset sort', this.render, this);
        this.listenTo(this.model, 'add', this._onAdd, this);
        this.listenTo(this.model, 'remove', this._onRemove, this);
      }
    },

    // Overrides Backstage.View.renderTemplate().
    renderTemplate: function() {
      this.$el.empty();
      this.removeChildViews();
      
      if (!this.templateFunction) {
        this.templateFunction = Handlebars.compile(this.template || '');
      }
      
      if (this.model) { // assumes model is null or of type Backbone.Collection
        this.model.forEach(function(item) {
          this.addChildView(this.createChildView(item));
        }, this);
      }

      return this;
    },

    createChildView: function(model) {
      var view;
      var ItemViewClass = this._getItemViewClass();

      var attrs = {
        model: model,
        templateFunction: this.templateFunction
      };
      
      if (this.itemViewTagName) {
        attrs.tagName = this.itemViewTagName;
      }
      
      view = new ItemViewClass(attrs);
      view.$el.attr(ID_ATTRIBUTE, model.cid);

      return view;
    },

    // Overrides Backstage.View.renderChildViews().
    renderChildViews: function() {
      _.each(this.childViews, function(childView) {
        this.$el.append(childView.render().$el);
      }, this);
      
      return this;
    },

    // PRIVATE METHODS

    _getItemViewClass: function() { // caches first time
      if (!this._itemViewClass) {
        this._itemViewClass = (_.isString(this.itemViewClass) ? getViewClass(this.itemViewClass) : this.itemViewClass) || View;
      }

      return this._itemViewClass;
    },

    _onAdd: function(item, sender, options) {
      var index = (options && _.isNumber(options.at)) ? options.at : this.childViews.length;
      var childView = this.createChildView(item);

      this.insertChildViewAt(childView, index);
      childView.render();
      
      if (index === 0) {
        this.$el.prepend(childView.$el);
      }
      else {
        this.childViews[index - 1].$el.after(childView.$el);
      }
    },

    _onRemove: function(item, sender, options) {
      this.removeChildViewAt(options.index);
    },
    
    // PRIVATE PROPERTIES
    
    _itemViewClass: null

  });

  registerViewClass('CollectionView', CollectionView);

  Handlebars.registerHelper('collection', function(model, options) {
    if (options) {
      options.hash.model = _.isString(model) ? getModel(model) : model;
    }
    else {
      options = model;
    }
    
    return viewBlockHelper('CollectionView', options); // simply call the basic view block helper with "CollectionView" as class
  });

}(this));
