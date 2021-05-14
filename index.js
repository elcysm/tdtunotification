var express = require("express");
var app = express();
var http = require("http").createServer(app);
var socketIO = require("socket.io")(http);
var formidable = require("formidable");
var fileSystem = require("fs");
var mongoClient = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;
const session = require('express-session');
var bodyParser = require("body-parser");
var expressSession = require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const keys = require('./keys')
var bcrypt = require("bcrypt");
const passport = require('passport');
const path = require('path');
var mv = require('mv');

if(process.env.NODE_ENV === 'production') {
	app.use(express.static(path.join(__dirname, '/public')));
  
	app.get('*', (req, res) => {
	  res.sendFile(path.join(__dirname, '/public'))
	});
}
app.use(express.static(__dirname + '/public'));

var nodemailer = require("nodemailer");

var mainURL = "http://localhost:5000";

var avatar = "/public/img/lecture.png"

app.use(bodyParser.json( { limit: "10000mb" } ));
app.use(bodyParser.urlencoded( { extended: true, limit: "10000mb", parameterLimit: 1000000 } ));
var MemoryStore = require('memorystore')(session)
app.use(expressSession({
"key": "user_id",
"secret": "User secret object ID",
'store': new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
"resave": true,
"saveUninitialized": true
}));


  
 

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var database = null;

function getUser(userId, callBack) {
database.collection("users").findOne({
"_id": ObjectId(userId)
}, function (error, result) {
if (error) {
	console.log(error);
	return;
}
if (callBack != null) {
	callBack(result);
}
});

}

const port =process.env.PORT || 8080

http.listen(port, function () {
console.log("Server started at http://localhost:"+ port);

socketIO.on("connection", function (socket) {
//
});

app.use(session({
	resave: false,
	saveUninitialized: true,
	secret: 'SECRET'
  }));

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function (user, cb) {
cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
cb(null, obj);
});
passport.use(
new GoogleStrategy(
	{
	clientID: keys.googleAuth.googleClientID,
	clientSecret: keys.googleAuth.googleClientSecret,
	callbackURL: '/auth/google/callback'
	},
	function (accessToken, refreshToken, notifications, done) {
	return done(null, notifications);
	}
)
);

app.get('/auth/google',passport.authenticate('google', {
	scope: ['profile', 'email']
  }));
  
  
app.get('/auth/google/callback', 
passport.authenticate('google', {
	successRedirect: '/student_user',
}));
  
app.get('/weather',function (req, res){
	res.render('weather',{
		user:req.user
	})
})

mongo = process.env.MONGO_URL
mongoClient.connect(mongo || "mongodb://localhost:27017", { useUnifiedTopology: true }, function (error, client) {
if (error) {
	console.log(error);
	return;
}
database = client.db("notification");

app.get("/", function (request, result) {
	if (!request.session.user_id || !request.session.idSV){
		result.redirect("/login")
	} else {
		result.render("posts", {
			"isLogin": request.session.user_id ? true : false,
			"isLogina" : request.session.idSV ? true : false,
			"url": request.url,
			"id" : request.session.user_id,
			"idSV" :request.session.idSV
		});
	}
	
})

app.get("/student_user", function (req, res) {

	user=req.user
	nameSV = req.user.displayName
	email=req.user.emails[0]
	photo=req.user.photos[0]
	

	if (!email.value.includes("@student.tdtu.edu.vn")) {
		res.render("login", {
			"error": "Email không hợp lệ, vui lòng sử dụng email Sinh viên",
			"message" : ""
		});
		}
	else{
		database.collection("users").findOne({"email": email.value},
		function(err, obj)	
		{
			if (!obj){
				database.collection("users").insertOne({
					"email": email.value,
					"name": nameSV,
					"avatar" : photo.value})
				database.collection("users").findOne({"email": email.value},
					function(err, obj2)	
					{
						req.session.idSV = obj2._id;
						if (obj2.email){
							res.redirect("/posts")
						}
					});
			} 
			else {
				req.session.idSV = obj._id;
				res.redirect("/posts")
			}
		})
	}
});


app.get("/register", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		result.redirect("/");
		return;
	}
	result.render("register", {
		"error": "",
		"message": ""
	});
});


app.post("/register", function (request, result) {
	var name = request.body.name;
	var email = request.body.email;
	var password = request.body.password;

	if (name == "" || email == "" || password == "") {
		result.render("register", {
			"error": "Please fill all fields",
			"message": ""
		});
		return;
	}

	database.collection("users").findOne({
		"email": email
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			bcrypt.hash(password, 10, function (error3, hash) {
				database.collection("users").insertOne({
					"name": name,
					"email": email,
					"password": hash,
				}, function (error2, data) {
					if (error2) {
						console.log(error2);
						return;
					}
				});
			});
		} else {
			result.render("register", {
				"error": "Email already exists",
				"message": ""
			});
		}
	});
});


app.get("/add_user", function (request, result) {

		if (request.session.user_id || request.session.idSV) {
			getUser(request.session.user_id || request.session.idSV, function (user) {
				if (user.name ==="admin"){
					result.render("adduser", {
						"isLogin": true,
						"isLogina": true,
						"user": user,
						"message": "",
						"error":  "",
					});
					
				}
				else {
					result.redirect("/403")
				}
			});
		}
			else {
				result.redirect("/login");
			}
});



app.get("/edit_user", function (request, result) {

	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
			if (user.name ==="admin"){
				result.render("edituser", {
					"isLogin": true,
					"isLogina": true,
					"user": user,
					"message": "",
					"error":  "",
				});
				
			}
			else {
				result.redirect("/403")
			}
		});
	}
		else {
			result.redirect("/login");
		}
});


app.post("/edit_user", function (request, result) {
	var name = request.body.name;
	var role = request.body.role;
	var username = request.body.username;
	var password = request.body.password;
	var avatar = "/public/img/lecture.png"
	if (name == "" || role == "" || username == "" || password == "") {
		result.render("edituser", {
			"error": "Hãy nhập đầy đủ thông tin",
			"message": "",
			"isLogin": true,
			"isLogina": true,
			"avatar" : avatar,
			"user" : user
		});
		return;
	}

	database.collection("users").findOne({
		"username": username
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			bcrypt.hash(password, 10, function (error3, hash) {
				database.collection("users").insertOne({
					"name": name,
					"role" : role,
					"username": username,
					"password": hash,
					"avatar" :avatar
				}, function (error2, data) {
					if (error2) {
						console.log(error2);
						return;
						
					}
					result.render("edituser", {
						"error": "",
						"message": "Tạo tài khoản thành công",
						"isLogin": true,
						"isLogina": true,
						"avatar" : avatar,
						"user" : data
					});
				});
			});
		} else {
			result.render("edituser", {
				"error": "Username đã tồn tại",
				"message": "",
				"isLogin": true,
				"isLogina": true,
				"avatar" : avatar,
				"user" : user,
			});
		}
	});
});



app.get("/403", function (request, result) {
				result.render("403",{
					"message" :"",
				});
});


app.post("/add_user", function (request, result) {
	var name = request.body.name;
	var username = request.body.username;
	var password = request.body.password;
	var avatar = "/public/img/lecture.png"

	if (name == "" || username == "" || password == "") {
		result.render("adduser", {
			"error": "Hãy nhập đầy đủ thông tin",
			"message": "",
			"isLogin": true,
			"isLogina": true,
			"avatar" : avatar
		});
		return;
	}

	database.collection("users").findOne({
		"username": username
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			bcrypt.hash(password, 10, function (error3, hash) {
				database.collection("users").insertOne({
					"name": name,
					"username": username,
					"password": hash,
					"avatar" :avatar
				}, function (error2, data) {
					if (error2) {
						console.log(error2);
						return;
					}
					result.render("adduser", {
						"error": "",
						"message": "Tạo tài khoản thành công",
						"isLogin": true,
						"isLogina": true,
						"avatar" : avatar
					});
				});
			});
		} else {
			result.render("adduser", {
				"error": "Username đã tồn tại",
				"message": "",
				"isLogin": true,
				"isLogina": true,
				"avatar" : avatar
			});
		}
	});
});






app.get("/login", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		res.redirect("/posts");
	}
	else {
		res.render("login", {
			"error": "",
			"message": ""
		});
	}
});

app.get("/faculty", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		database.collection("users").find({}).toArray(function (error1, users) {
			res.render("faculty", {
				"isLogin": true,
				"users": users,
				"url": req.url,
				"user" : users,
			});
			console.log(users.role)
		});
		
	}
	else {
		res.redirect("/login");
	}
});


app.post("/login", function (request, result) {
	var username = request.body.username;
	var password = request.body.password;

	if (username == "" || password == "") {
		result.render("login", {
			"error": "Vui lòng nhập đầy đủ thông tin",
			"message": ""
		});
		return;
	}

	database.collection("users").findOne({
		"username": username
	}, function (error1, user) {
		if (error1) {
			console.log(error1);
			return;
		}

		if (user == null) {
			result.render("login", {
				"error": "username",
				"message": ""
			});
		} else {
			bcrypt.compare(password, user.password, function (error2, isPasswordVerify) {
				if (isPasswordVerify) {
					request.session.user_id = user._id;
					result.redirect("/posts");
				} else {
					result.render("login", {
						"error": "Mật khẩu không hợp lệ",
						"message": ""
					});
				}
			});
		}
	});
});

app.get("/logout", function (req, res) {
	req.session.destroy();
	res.redirect("/login");
});

app.get("/upload", function (request, result) {

	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
		nameKhoa = user.name
		console.log(nameKhoa)
		database.collection("users").findOne({"name" : nameKhoa})
			result.render("upload", {
				"isLogin": true,
				"isLogina": true,
				"role": user.role,
				"user" : user,
				"message": request.query.message ? "Settings has been saved" : "",
				"error": request.query.error ? "Please fill all fields" : "",
				"url": request.url
			});
		});
	}
		else {
			result.redirect("/login");
		}
});


app.get("/get_user", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		getUser(req.session.user_id || req.session.idSV , function (user) {
			if (user == null) {
				res.json({
					"status": "error",
					"message": "User not found"
				});
			} else {
				delete user.password;

				res.json({
					"status": "success",
					"message": "Record has been fetched",
					"user": user
				});
			}
		});
	} else {
		res.json({
			"status": "error",
			"message": "Please login to perform this action."
		});
	}
});

app.post("/upload-video", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		var formData = new formidable.IncomingForm();
		formData.maxFileSize = 1000 * 1024 * 1204;
		formData.parse(request, function (error1, fields, files) {
			
			var video_link = fields.video;
  			var videolink_cut = video_link.split("watch?v=");
  			var videolink_final = "https://www.youtube.com/embed/" +videolink_cut[videolink_cut.length-1]  
			var title = fields.title;
			var description = fields.description;
			var tags = fields.tags;
			var videoId = fields.videoId;
			var thumbnail = fields.thumbnailPath;

			var oldPathThumbnail = files.thumbnail.path;
			var thumbnail = "./public/thumbnails/" + new Date().getTime() + "-" + files.thumbnail.name;

			mv(oldPathThumbnail, thumbnail, function (error2) {
				console.log("thumbnail upload error = ", error2);
			});

			
				getUser(request.session.user_id || request.session.idSV, function (user) {
					
					delete user.password;
					var currentTime = new Date().getTime();
					
						database.collection("posts").insertOne({
							"user": {
								"_id": user._id,
								"name": user.name,
								"avatar": user.avatar,
								"role" : user.role
							},
							"createdAt": currentTime,
							"video_link" :videolink_final,
							"views": 0,
							"watch": currentTime,
							"title": title,
							"description": description,
							"tags": tags,
							"thumbnail": thumbnail
						}, function (error3, data) {

							database.collection("users").updateOne({
								"_id": ObjectId(request.session.user_id || request.session.idSV)
							}, {
								$push: {
									"posts": {
										"_id": data.insertedId,
										"createdAt": currentTime,
										"video_link" :videolink_final,
										"views": 0,
										"watch": currentTime,
										"title": title,
										"description": description,
										"tags": tags,
										"thumbnail": thumbnail
									}
								}
							}, function (error4, data1) {
								result.redirect("posts");
							});
						});

				});

		});
	} else {
		result.json({
			"status": "error",
			"message": "Please login to perform this action."
		});
	}
});

app.get("/posts", function (request, result) {

	database.collection("posts").find({}).sort({"createdAt": -1}).limit(10).toArray(function (error1,posts) {
		result.render("index", {
			"isLogin": true,
			"isLogina": true,
			"posts": posts,
			"url": request.url
		});
	});
});

app.post("/save-video", function (request, result) {
	if (request.session.user_id) {
		var title = request.body.title;
		var description = request.body.description;
		var tags = request.body.tags;
		var videoId = request.body.videoId;

		database.collection("users").findOne({
			"_id": ObjectId(request.session.user_id),
			"videos._id": ObjectId(videoId)
		}, function (error1, video) {
			if (video == null) {
				result.send("Sorry you do not own this video");
			} else {
				database.collection("videos").updateOne({
					"_id": ObjectId(videoId)
				}, {
					$set: {
						"title": title,
						"description": description,
						"tags": tags,
						"category": request.body.category,
						"minutes": request.body.minutes,
						"seconds": request.body.seconds
					}
				}, function (error1, data) {

					database.collection("users").findOneAndUpdate({
						$and: [{
							"_id": ObjectId(request.session.user_id)
						}, {
							"videos._id": ObjectId(videoId)
						}]
					}, {
						$set: {
							"videos.$.title": title,
							"videos.$.description": description,
							"videos.$.tags": tags,
							"videos.$.category": request.body.category,
							"videos.$.minutes": request.body.minutes,
							"videos.$.seconds": request.body.seconds
						}
					}, function (error2, data1) {
						result.json({
							"status": "success",
							"message": "Video has been published"
						});
					});
				});
			}
		});
	} else {
		result.json({
			"status": "danger",
			"message": "Please login to perform this action."
		});
	}
});

app.post("/edit", function (request, result) {
	if (request.session.user_id) {

		var formData = new formidable.IncomingForm();
		formData.parse(request, function (error1, fields, files) {
			var title = fields.title;
			var description = fields.description;
			var tags = fields.tags;
			var videoId = fields.videoId;
			var thumbnail = fields.thumbnailPath;

			if (files.thumbnail.size > 0) {
				
				if (typeof fields.thumbnailPath !== "undefined" && fields.thumbnailPath != "") {
					fileSystem.unlink(fields.thumbnailPath, function (error3) {
						//
					});
				}

				var oldPath = files.thumbnail.path;
				var newPath = "public/thumbnails/" + new Date().getTime() + "-" + files.thumbnail.name;
				thumbnail = newPath;

				fileSystem.rename(oldPath, newPath, function (error2) {
					//
				});
			}

			database.collection("users").findOne({
				"_id": ObjectId(request.session.user_id),
				"videos._id": ObjectId(videoId)
			}, function (error1, video) {
				if (video == null) {
					result.send("Sorry you do not own this video");
				} else {
					database.collection("videos").findOneAndUpdate({
						"_id": ObjectId(videoId)
					}, {
						$set: {
							"title": title,
							"description": description,
							"tags": tags,
							"category": fields.category,
							"thumbnail": thumbnail
						}
					}, function (error1, data) {

						database.collection("users").findOneAndUpdate({
							$and: [{
								"_id": ObjectId(request.session.user_id)
							}, {
								"videos._id": ObjectId(videoId)
							}]
						}, {
							$set: {
								"videos.$.title": title,
								"videos.$.description": description,
								"videos.$.tags": tags,
								"videos.$.category": fields.category,
								"videos.$.thumbnail": thumbnail
							}
						}, function (error2, data1) {
							getUser(request.session.user_id, function (user) {
								var video = data.value;
								video.thumbnail = thumbnail;

								result.render("edit-video", {
									"isLogin": true,
									"video": video,
									"user": user,
									"url": request.url,
									"message": "Video has been saved"
								});
							});
						});
					});
				}
			});
		});
	} else {
		result.redirect("/login");
	}
});

app.get("/watch", function (request, result) {
	database.collection("posts").findOne({
		"watch": parseInt(request.query.v)
	}, function (error1, video) {
		if (video == null) {
			result.render("403", {
				"isLogin": request.session.user_id ? true : false,
				"message": "Video does not exist.",
				"url": request.url
			});
		} else {

			database.collection("posts").updateOne({
				"_id": ObjectId(video._id)
			}, {
				$inc: {
					"views": 1
				}
			});

			database.collection("users").updateOne({
				$and: [{
					"_id": ObjectId(video.user._id)
				}, {
					"videos._id": ObjectId(video._id)
				}]
			}, {
				$inc: {
					"videos.$.views": 1
				}
			});

			getUser(video.user._id, function (user) {
				result.render("video-page", {
					"isLogin": request.session.user_id ? true : false,
					"video": video,
					"user": user,
					"url": request.url
				});
			});
		}
	});
});

app.get("/channel", function (request, result) {
	database.collection("users").findOne({
		"_id": ObjectId(request.query.c)
	}, function (error1, user) {
		if (user == null) {
			result.render("404", {
				"isLogin": request.session.user_id ? true : false,
				"message": "Channel not found",
				"url": request.url
			});
		} else {
			result.render("single-channel", {
				"isLogin": request.session.user_id ? true : false,
				"user": user,
				"headerClass": "single-channel-page",
				"footerClass": "ml-0",
				"isMyChannel": request.session.user_id == request.query.c,
				"error": request.query.error ? request.query.error : "",
				"url": request.url,
				"message": request.query.message ? request.query.message : "",
				"error": ""
			});
		}
	});
});



app.get("/my_channel", function (req, res) {
	if (req.session.user_id || req.session.idSV) {
		database.collection("users").findOne({
			"_id": ObjectId(req.session.user_id)
		}, function (error1, user) {
			res.render("single-channel", {
				"isLogin": true,
				"user": user,
				"headerClass": "single-channel-page",
				"footerClass": "ml-0",
				"isMyChannel": true,
				"message": req.query.message ? req.query.message : "",
				"error": req.query.error ? req.query.error : "",
				"url": req.url
			});
		});
	} else {
		res.redirect("/login");
	}
});

app.get("/edit", function (request, result) {
	if (request.session.user_id) {
		database.collection("posts").findOne({
			"watch": parseInt(request.query.v)
		}, function (error1, video) {
			if (video == null) {
				result.render("403", {
					"isLogin": true,
					"message": "This video does not exist.",
					"url": request.url
				});
			} else {
				if (video.user._id != request.session.user_id) {
					result.send("Sorry you do not own this video.");
				} else {
					getUser(request.session.user_id, function (user) {
						result.render("edit-video", {
							"isLogin": true,
							"video": video,
							"user": user,
							"url": request.url
						});
					});
				}
			}
		});
	} else {
		result.redirect("/login");
	}
});

app.post("/do-like", function (request, result) {
	result.json({
		"status": "success",
		"message": "Like/dislike feature is in premium version. Kindly read README.txt to get full version."
	});
});

app.post("/do-dislike", function (request, result) {
	result.json({
		"status": "success",
		"message": "Like/dislike is in premium version. Kindly read README.txt to get full version."
	});
});

app.post("/do-comment", function (request, result) {
	if (request.session.user_id) {
		var comment = request.body.comment;
		var videoId = request.body.videoId;

		getUser(request.session.user_id, function (user) {
			delete user.password;

			database.collection("videos").findOneAndUpdate({
				"_id": ObjectId(videoId)
			}, {
				$push: {
					"comments": {
						"_id": ObjectId(),
						"user": {
							"_id": user._id,
							"first_name": user.first_name,
							"last_name": user.last_name,
							"image": user.image
						},
						"comment": comment,
						"createdAt": new Date().getTime()
					}
				}
			}, function (error1, data) {
				result.json({
					"status": "success",
					"message": "Comment has been posted",
					"user": {
						"_id": user._id,
						"first_name": user.first_name,
						"last_name": user.last_name,
						"image": user.image
					},
					"comment": comment
				});
			});
		});
	} else {
		result.json({
			"status": "danger",
			"message": "Please login to perform this action."
		});
	}
});

app.post("/do-reply", function (request, result) {
	if (request.session.user_id) {
		var reply = request.body.reply;
		var commentId = request.body.commentId;

		getUser(request.session.user_id, function (user) {
			delete user.password;

			var replyObject = {
				"_id": ObjectId(),
				"user": {
					"_id": user._id,
					"first_name": user.first_name,
					"last_name": user.last_name,
					"image": user.image
				},
				"reply": reply,
				"createdAt": new Date().getTime()
			};

			database.collection("videos").findOneAndUpdate({
				"comments._id": ObjectId(commentId)
			}, {
				$push: {
					"comments.$.replies": replyObject
				}
			}, function (error1, data) {
				result.json({
					"status": "success",
					"message": "Reply has been posted",
					"user": {
						"_id": user._id,
						"first_name": user.first_name,
						"last_name": user.last_name,
						"image": user.image
					},
					"reply": reply
				});
			});
		});
	} else {
		result.json({
			"status": "danger",
			"message": "Please login to perform this action."
		});
	}
});

app.get("/get-related-videos", function (request, result) {
	database.collection("videos").find({
		$and: [{
			"category": request.query.category
		}, {
			"_id": {
				$ne: ObjectId(request.query.videoId)
			}
		}]
	}).toArray(function (error1, videos) {
		result.json(videos);
	});
});

app.get("/search", function (request, result) {

	database.collection("videos").find({
		"title":  {
			$regex: request.query.search_query,
			$options: "i"
		}
	}).toArray(function (error1, videos) {
		result.render("search-query", {
			"isLogin": request.session.user_id ? true : false,
			"videos": videos,
			"query": request.query.search_query,
			"url": request.url
		});
	});
});

app.get("/my_settings", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
			result.render("settings", {
				"isLogin": true,
				"isLogina": true,
				"user": user,
				"message": request.query.message ? "Settings has been saved" : "",
				"error": request.query.error ? "Please fill all fields" : "",
				"url": request.url
			});
		});
	}
		else {
			result.redirect("/login");
		}
});


app.get("/my_settings2", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		getUser(request.session.user_id || request.session.idSV, function (user) {
		nameKhoa = user.name
		console.log(nameKhoa)
		database.collection("users").findOne({"name" : nameKhoa})
			result.render("settings2", {
				"isLogin": true,
				"isLogina": true,
				"role": user.role,
				"user" : user,
				"message": request.query.message ? "Settings has been saved" : "",
				"error": request.query.error ? "Please fill all fields" : "",
				"url": request.url
			});
		});
	}
		else {
			result.redirect("/login");
		}
});




app.post("/save_settings", function (request, result) {
	if (request.session.user_id || request.session.idSV) {
		var password = request.body.password;

		if (request.body.first_name == "" || request.body.last_name == "") {
			result.redirect("/my_settings?error=1");
			return;
		}

		if (password == "") {
			database.collection("users").updateOne({
				"_id": ObjectId(request.session.user_id)
			}, {
				$set: {
					"first_name": request.body.first_name,
					"last_name": request.body.last_name
				}
			});
		} else {
			bcrypt.hash(password, 10, function (error1, hash) {
				database.collection("users").updateOne({
					"_id": ObjectId(request.session.user_id)
				}, {
					$set: {
						"first_name": request.body.first_name,
						"last_name": request.body.last_name,
						"password": hash
					}
				});
			});
		}

		database.collection("users").updateOne({
			"subscriptions.channelId": ObjectId(request.session.user_id)
		}, {
			$set: {
				"subscriptions.$.channelName": request.body.first_name + " " + request.body.last_name
			}
		});

		database.collection("users").updateOne({
			"subscriptions.subscribers.userId": ObjectId(request.session.user_id)
		}, {
			$set: {
				"subscriptions.subscribers.$.channelName": request.body.first_name + " " + request.body.last_name
			}
		});

		database.collection("users").updateOne({
			"subscribers.userId": ObjectId(request.session.user_id)
		}, {
			$set: {
				"subscribers.$.channelName": request.body.first_name + " " + request.body.last_name
			}
		});

		database.collection("videos").updateOne({
			"user._id": ObjectId(request.session.user_id)
		}, {
			$set: {
				"user.first_name": request.body.first_name,
				"user.last_name": request.body.last_name
			}
		});

		result.redirect("/my_settings?message=1");
	} else {
		result.redirect("/login");
	}
});

app.post("/update-social-media-link", function (request, result) {
	result.json({
		"status": "success",
		"message": "Video has been liked"
	});
});

app.get("/delete-video", function (request, result) {
	if (request.session.user_id) {
		database.collection("videos").findOne({
			$and: [{
				"user._id": ObjectId(request.session.user_id)
			}, {
				"watch": parseInt(request.query.v)
			}]
		}, function (error1, video) {
			if (video == null) {
				result.render("404", {
					"isLogin": true,
					"message": "Sorry, you do not own this video."
				});
			} else {
				database.collection("videos").findOne({
					"_id": ObjectId(video._id)
				}, function (error3, videoData) {
					fileSystem.unlink(videoData.filePath, function (errorUnlink) {
						if (errorUnlink) {
							console.log(errorUnlink);
						}

						database.collection("videos").remove({
							$and: [{
								"_id": ObjectId(video._id)
							}, {
								"user._id": ObjectId(request.session.user_id)
							}]
						});
					});
				});

				database.collection("users").findOneAndUpdate({
					"_id": ObjectId(request.session.user_id)
				}, {
					$pull: {
						"videos": {
							"_id": ObjectId(video._id)
						}
					}
				}, function (error2, data) {
					result.redirect("/my_videos?message=Video+has+been+deleted");
				});
			}
		});
	} else {
		result.redirect("/login");
	}
});


}); // end of Mongo DB
}); //  end of HTTP.listen
