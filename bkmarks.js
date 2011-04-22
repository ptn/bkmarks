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


	window.Bookmark = Backbone.Model.extend({
		initialize: function() {
			if (this.isNew() && this.get("url")) {
				this.setHostname();
				this.addProtocolToUrl();
			}
			this.bind('change:url', this.setHostname);
			this.bind('change:url', this.addProtocolToUrl);
		},

		addProtocolToUrl: function() {
			if (!this.get("url").match(/https?:\/\//))
				this.set({url: "http://" + this.get("url")});
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


	window.BookmarkView = Backbone.View.extend({
		tagName: "li",

		template: _.template($("#bk-template").html()),

		events: {
			"mouseover": "showDestroy",
			"mouseout": "hideDestroy",
			"click .destroy": "destroy"
		},

		initialize: function() {
			_.bindAll(this, 'render', 'showDestroy', 'hideDestroy', 'destroy');
			this.model.bind('change', this.render);
			this.model.view = this;
		},

		render: function() {
			$(this.el).html(this.template(this.model.toJSON()));
			return this;
		},

		showDestroy: function() {
			this.$(".destroy").show();
		},

		hideDestroy: function() {
			this.$(".destroy").hide();
		},

		destroy: function() {
			this.model.destroy();
			this.remove();
		}
	});


	window.AppView = Backbone.View.extend({
		el: $("#bkmarks-app"),

		events: {
			"click #save-btn": "create",
            "keypress #new_title": "createOnEnter",
            "keypress #new_url": "createOnEnter",
		},

		initialize: function() {
			_.bindAll(this, 'render', 'addOne', 'addAll');
			this.title = this.$("#new_title");
			this.url = this.$("#new_url");
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

		create: function() {
			Bookmarks.create({
				title: this.title.val(),
				url: this.url.val(),
			}, {error: this.showError});
			this.title.val('');
			this.url.val('');
		},

		addOne: function(bk) {
			var view = new BookmarkView({model: bk});
			this.$("#bk-list").append(view.render().el);
			this.refreshCount();
		},

		addAll: function() {
			Bookmarks.each(this.addOne);
			this.refreshCount();
		},

		refreshCount: function() {
			$("#bk-count").text("(" + Bookmarks.length + ")");
		},

	});
	window.App = new AppView;
});
