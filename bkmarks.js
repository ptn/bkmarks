$(function() {
	String.prototype.getHostname = function() {
		var url_regex = new RegExp('^((?:f|ht)tp(?:s)?\://)?([^/]+)', 'im');
		var url_match = this.match(url_regex);
		if (url_match) {
			var hostname = url_match[2].toString();
			var subdomain_match = hostname.match(/^(.+)\.((.+)\.(.+))$/);
			if(subdomain_match) {
				hostname = subdomain_match[2];
			}
			return hostname;
		} else
			return "";
	};


	window.Bookmark = Backbone.Model.extend({
		initialize: function() {
			var host = this.get("url").getHostname();
			var ret = this.set({hostname: host});
			this.addProtocolToUrl();
		},

		addProtocolToUrl: function() {
			if(!this.get("url").match(/https?:\/\//))
				this.set({url: "http://" + this.get("url")});
		},

		/*validate: function(attrs) {
			if(attrs.title == "" || attrs.title == null)
				return "Title can't be blank";
			if(attrs.url == "" || attrs.url == null)
				return "Url can't be blank";
		}*/
	});


	window.BookmarkList = Backbone.Collection.extend({
		model: Bookmark,
		localStorage: new Store("bks")
	});
	window.Bookmarks = new BookmarkList;


	window.BookmarkView = Backbone.View.extend({
		tagname: "li",

		template: _.template($("#bk-template").html()),

		initialize: function() {
			_.bindAll(this, 'render');
			this.model.bind('change', this.render);
			this.model.view = this;
		},

		render: function() {
			$(this.el).html(this.template(this.model.toJSON()));
			return this;
		},
	});


	window.AppView = Backbone.View.extend({
		el: $("#bkmarks-app"),

		events: {
			"click #save-btn": "create"
		},

		initialize: function() {
			_.bindAll(this, 'render', 'addOne', 'addAll');
			this.title = this.$("#new_title");
			this.url = this.$("#new_url");
			Bookmarks.bind('add', this.addOne);
			Bookmarks.bind('refresh', this.addAll);
			Bookmarks.fetch();
		},

		create: function() {
			Bookmarks.create({
				title: this.title.val(),
				url: this.url.val(),
			});
			this.title.val('');
			this.url.val('');
		},

		addOne: function(bk) {
			var view = new BookmarkView({model: bk});
			this.$("#bk-list").append(view.render().el);
		},

		addAll: function() {
			Bookmarks.each(this.addOne);
		},
	});
	window.App = new AppView;
});
