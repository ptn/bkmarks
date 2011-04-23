$(function() {
  String.prototype.getHostname = function() {
    var url_regex = new RegExp('^((?:f|ht)tp(?:s)?\://)?([^/]+)', 'im');
      var url_match = this.match(url_regex);
    if (url_match) {
      var hostname = url_match[2].toString();
      var subdomain_match = hostname.match(/^(.+)\.((.+)\.(.+))$/);
      if (subdomain_match) {
        hostname = subdomain_match[2];
      }
      return hostname;
    } else
      return "";
  };

  window.Util = {
    parseTags: function(tags_input) {
      return _.uniq(tags_input.split(/,?\s+/));
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
        this.setHostname();
        this.addProtocolToUrl();
      }
      this.bind('change:url', this.setHostname);
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

        setHostname: function() {
          var host = this.get("url").getHostname();
          var ret = this.set({hostname: host});
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
      "click .edit-btn": "saveEdit",
      "click .cancel": "stopEdit",
      "keypress .edit_title": "editOnEnter",
      "keypress .edit_url": "editOnEnter",
      "keypress .edit_tags": "editOnEnter",
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

    startEdit: function() {
      this.editTitle = this.$(".edit_title");
      this.editUrl = this.$(".edit_url");
      this.editTags = this.$(".edit_tags");
      $(this.el).addClass("editing");
      this.editTitle.val(this.model.get("title"));
      this.editUrl.val(this.model.get("url"));
      this.editTags.val(this.model.tagsAsString());
      this.editTitle.focus();
    },

    saveEdit: function() {
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

    stopEdit: function() {
      $(this.el).removeClass("editing");
    },

    editOnEnter: function(e) {
      if (e.keyCode != 13) return;
      this.saveEdit();
    },

    remove: function() {
      $(this.el).fadeOut('slow', function() { $(this.el).remove(); });
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
      "keyup": "delayedSearch",
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

    delayedSearch: function(e) {
      var input = this.$("input");
      var search = this.search;
      var clearSearch = this.clearSearch;
      Util.delay(function() {
        if (input.val())
          search();
        else
          clearSearch();
      }, 500);
    },
  });
  window.Search = new SearchView;

  window.AppView = Backbone.View.extend({
    el: $("#bkmarks-app"),

    events: {
      "click #save-btn": "create",
      "keypress #new_title": "createOnEnter",
      "keypress #new_url": "createOnEnter",
      "keypress #new_tags": "createOnEnter",
      "click #show-create-bk": "showNewBkForm",
      "click #hide-create-bk": "hideNewBkForm",
    },

    initialize: function() {
      _.bindAll(this, 'render', 'addOne', 'addAll', 'clear');
      this.title = this.$("#new_title");
      this.url = this.$("#new_url");
      this.tags = this.$("#new_tags");
      Bookmarks.bind('add', this.addOne);
      Bookmarks.bind('refresh', this.addAll);
      Bookmarks.bind('remove', this.refreshCount);
      Bookmarks.fetch();
    },

    showError: function(model, error) {
      $("#error").text(error);
      $("#error").addClass("error");
      $("#error").show();
      $("#error").fadeOut(5000);
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
        this.clear();
        this.hideNewBkForm();
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

    showNewBkForm: function() {
      this.$("#create-bk").show("slow");
      this.$("#new_title").focus();
    },

    hideNewBkForm: function() {
      this.clear();
      this.$("#create-bk").hide("slow");
    },
  });
  window.App = new AppView;
});
