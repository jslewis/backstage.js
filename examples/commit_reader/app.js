/*global CommitReader, Backstage*/

// Constructor
CommitReader.App = function() {
  this.initialize();
};

_.extend(CommitReader.App.prototype, {

  eventCollection: null,
  
  mainView: null,
  
  // PUBLIC METHODS

  initialize: function() {
    // Create the app's main collection
    this.eventCollection = new CommitReader.EventCollection();

    // Register this collection so our templates can refer to it
    Backstage.registerModel('events', this.eventCollection);

    // Listen for the jsonp success callback
    Backbone.on('fetchEventsSuccess', this._onEventsFetchSuccess, this);
    
    // Listen for the refresh button
    Backbone.on('refresh', this.refresh, this);
  },

  run: function() {
    console.log('running');
    
    this.mainView = new CommitReader.MainView();
    $('body').replaceWith(this.mainView.$el);

    this.refresh();
  },
  
  refresh: function() {
    //$.getScript('sample_data.js');
    $.getScript('https://api.github.com/events?callback=CommitReader.parseEvents', function() {
      $('body').scrollTop(0);
    });
  },
  
  // PRIVATE METHODS
  
  _onEventsFetchSuccess: function(response) {
    var events = _.where(response.data, { type: 'PushEvent' });
    this.eventCollection.reset(events);
  }
  
});

// jsonp callback function
CommitReader.parseEvents = function(response) {
  Backbone.trigger('fetchEventsSuccess', response);
};
