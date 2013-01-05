/*global CommitReader*/

CommitReader.EventCollection = Backbone.Collection.extend({
  
  model: CommitReader.Event,
  
  initialize: function() {
    // For convenience
    this.on('add remove reset', function() {
      this.trigger('change:length', this, this.length);
    }, this);    
  }
  
});
