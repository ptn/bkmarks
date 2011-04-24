$(function() {
  window.Util = {
    parseTags: function(tags_input) {
      return _.uniq(tags_input.trim().split(/,?\s+/));
    },

    delay: (function() {
      var timer = 0;
      return function(callback, ms) {
        clearTimeout(timer);
        timer = setTimeout(callback, ms);
      };
    })(),
  };

  window.Tag = Backbone.Model.extend();

  window.TagList = Backbone.Collection.extend({
    model: Tag,
    localStorage: new Store("tags"),
  });


  window.Bookmark = Backbone.Model.extend({
    initialize: function() {
      _.bindAll(this, 'hasTag', 'hasTags');
      if (this.isNew() && this.get("url")) {
        this.addProtocolToUrl();
      }
      this.bind('change:url', this.addProtocolToUrl);
    },

    hasTag: function(tag) {
      return _.include(this.get("tags"), tag);
    },

    // Optimize.
    hasTags: function(tags) {
      return _.all(tags, this.hasTag);
    },

    tagsAsString: function() {
      return this.get("tags").join(", ");
    },

    addProtocolToUrl: function() {
      if (!this.get("url").match(/https?:\/\//)) {
        this.set({url: "http://" + this.get("url")});
      }
    },

        validate: function(attrs) {
          if (!(typeof attrs.title === 'undefined') && attrs.title == "") {
            return "Title can't be blank";
          }
          if (!(typeof attrs.url === 'undefined') && attrs.url == "" ) {
            return "Url can't be blank";
          }
        }
  });


  window.BookmarkList = Backbone.Collection.extend({
    model: Bookmark,
    localStorage: new Store("bks")
  });
  window.Bookmarks = new BookmarkList;
  // Bookmarks that don't match the search terms.
  window.NotResults = new BookmarkList;


  window.BookmarkView = Backbone.View.extend({
    tagName: "li",

    template: _.template($("#bk-template").html()),

    events: {
      "mouseover": "showControls",
      "mouseout": "hideControls",
      "click .destroy-img": "destroy",
      "click .edit-img": "startEdit",
      "click .edit-btn": "edit",
      "click .cancel-edit": "cancelEdit",
      "keypress": "editOnEnter",
      "keyup": "cancelEditOnEscape",
    },

    initialize: function() {
      _.bindAll(this, 'render', 'showControls', 'hideControls', 'destroy', 'showError');
      this.model.bind('change', this.render);
      this.model.view = this;
    },

    render: function() {
      var json = this.model.toJSON();
      json.tags = this.model.tagsAsString();
      $(this.el).html(this.template(json));
      return this;
    },

    showControls: function() {
      this.$(".controls").show();
    },

    hideControls: function() {
      this.$(".controls").hide();
    },

    destroy: function() {
      this.model.destroy();
      this.remove();
    },

    centerEditForm: function() {
      $('html,body').animate({
        scrollTop: '+=' + this.$('.edit').offset().top + 'px'
      }, 'slow');
    },

    configureEditForm: function() {
      this.$(".saved").hide();
      this.$(".edit").show("slow");
      this.centerEditForm();
      this.editTitle.val(this.model.get("title"));
      this.editUrl.val(this.model.get("url"));
      this.editTags.val(this.model.tagsAsString());
      this.editTitle.focus();
    },

    startEdit: function() {
      this.editTitle = this.$(".edit_title");
      this.editUrl = this.$(".edit_url");
      this.editTags = this.$(".edit_tags");
      this.configureEditForm();
    },

    edit: function() {
      var tags = Util.parseTags(this.editTags.val());
      var res = this.model.save({
        title: this.editTitle.val(),
        url: this.editUrl.val(),
        tags: tags,
      }, { error: this.showError });
      if (res)
        $(this.el).removeClass("editing");
    },

    showError: function(model, error) {
      alert(error);
    },

    cancelEdit: function() {
      this.$(".edit").hide();
      this.$(".saved").show("fast");
    },

    cancelEditOnEscape: function(e) {
      if (e.keyCode != 27) return;
      this.cancelEdit();
    },

    editOnEnter: function(e) {
      if (e.keyCode != 13) return;
      this.edit();
    },

    remove: function() {
      $(this.el).fadeOut('fast', function() { $(this.el).remove(); });
    },

    hide: function() {
      $(this.el).hide('slow');
    },

    show: function() {
      $(this.el).show('slow');
    },
  });


  window.SearchView = Backbone.View.extend({
    el: $("#search"),

    events: {
      "keypress": "searchOnEnter",
      "keyup": "clearOrDelayedSearch",
      "click #clear-search": "clearSearch",
    },

    initialize: function() {
      _.bindAll(this, 'render', 'search', 'clearSearch');
    },

    clearSearch: function() {
      this.$("input").val('');
      NotResults.each(function(bk) { bk.view.show(); });
      NotResults.refresh([]);
      App.refreshCount();
      this.$("#clear-search").hide();
    },

    search: function() {
      var tags = Util.parseTags(this.$("input").val());
      var not_results = Bookmarks.select(function(bk) {
        if (bk.hasTags(tags)) {
          bk.view.show();
          return false;
        } else {
          bk.view.hide();
          return true;
        }
      });
      NotResults.refresh(not_results);
      App.refreshCount();
      this.$("#clear-search").show();
    },

    searchOnEnter: function(e) {
      if (e.keyCode != 13) return;
      this.search();
    },

    clearOrDelayedSearch: function(e) {
      if (e.keyCode == 27) {
        this.clearSearch();
        this.$("input").blur();
      } else {
        var input = this.$("input");
        var search = this.search;
        var clearSearch = this.clearSearch;
        Util.delay(function() {
          if (input.val())
            search();
          else
            clearSearch();
        }, 500);
      }
    },
  });
  window.Search = new SearchView;

  window.AppView = Backbone.View.extend({
    el: $("#bkmarks-app"),

    events: {
      "click #save-btn": "create",
      "keypress": "createOnEnter",
      "keyup": "cancelCreateOnEscape",
      "click #start-create": "startCreate",
      "click #cancel-create": "cancelCreate",
    },

    initialize: function() {
      _.bindAll(this, 'render', 'addOne', 'addAll', 'clear');
      this.title = this.$("#new_title");
      this.url = this.$("#new_url");
      this.tags = this.$("#new_tags");
      Bookmarks.bind('add', this.addOne);
      Bookmarks.bind('refresh', this.addAll);
      Bookmarks.bind('remove', this.render);
      Bookmarks.bind('all', this.render);
      Bookmarks.fetch();
    },

    render: function() {
      this.refreshCount();
      if (Bookmarks.length == 0) {
        this.startCreate();
      }
    },

    showError: function(model, error) {
      $("#error").text(error);
      $("#error").addClass("error");
      $("#error").show();
      $("#error").fadeOut(5000);
    },

    cancelCreateOnEscape: function(e) {
      if (e.keyCode != 27) return;
      this.cancelCreate();
    },

    createOnEnter: function(e) {
      if (e.keyCode != 13) return;
      this.create();
    },

    clear: function() {
      this.title.val('');
      this.url.val('');
      this.tags.val('');
    },

    create: function() {
      var tags = Util.parseTags(this.tags.val());
      var res = Bookmarks.create({
        title: this.title.val(),
        url: this.url.val(),
        tags: tags,
      }, {error: this.showError});
      if (res) {
        this.cancelCreate();
      }
    },

    addOne: function(bk) {
      var view = new BookmarkView({model: bk});
      this.$("#bk-list").append(view.render().el);
      this.refreshCount();
    },

    addAll: function() {
      Bookmarks.each(this.addOne);
    },

    refreshCount: function() {
      var showing = Bookmarks.length - NotResults.length;
      $("#bk-count").text("Showing " + showing + " / " + Bookmarks.length);
    },

    startCreate: function() {
      this.$("#create-bk").show("slow");
      this.$("#new_title").focus();
    },

    cancelCreate: function() {
      this.$("#create-bk").hide("fast");
      this.clear();
    },
  });
  window.App = new AppView;
});
