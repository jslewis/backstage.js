/*global CommitReader, Backstage*/

CommitReader.ButtonView = Backstage.View.extend({
  
  tagName: 'span',
  
  className: 'button',
  
  action: null,
  
  events: {
    click: '_onClick'
  },
  
  _onClick: function() {
    if (this.target && this.action) {
      this.target.trigger(this.action, this);
    }
  }

});

Backstage.registerViewClass('ButtonView', CommitReader.ButtonView);

Handlebars.registerHelper('button', function(options) {
  return Backstage.viewBlockHelper('ButtonView', options);
});
