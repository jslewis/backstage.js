/*global CommitReader, Backstage*/

CommitReader.MainView = Backstage.View.extend({
  
  tagName: 'body', // we'll replace the page 'body' tag with the belonging to this view
  
  initialize: function() {
    var that = this;

    // Fetch the template and render when it arrives
    $.get('views/main_view.template', function(response) {
      that.template = response;
      that.render();
    });
  }
  
});
