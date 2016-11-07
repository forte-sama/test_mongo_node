var http     = require('http');
var express  = require('express');
var session  = require('express-session');
var app      = express();
var bparser  = require('body-parser')
var path     = require('path');
var mongo    = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

app.use(bparser.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, 'static')));
app.set('view engine','ejs');

mongo.connect('mongodb://localhost:27017/entrega3', (error,db) => {
    if(error) return console.log(error);

    app.use(session({
        secret: 'entrega3',
        resave: false,
        saveUninitialized: false
    }));

    app.listen(8080, function() {
        console.log('Escuchando localmente en puerto 8080');
    });

    /*-------------------------------------------------------*/
    // Rutas
    /*-------------------------------------------------------*/
    app.get('/login',(req,res) => {
        if(req.session.user) {
            // TODO mandar algun mensajito flash diciendo que ya esta
            res.redirect(303,'/');
        }
        else {
            res.render('login');
        }
    });
    app.post('/login',(req,res) => {
        if(req.session.user) {
            res.redirect(303,'/');
        }
        else {
            var targetUser = req.body.username.toLowerCase();

            db.collection('usuarios').findOne({
                username: targetUser,
                password: req.body.password
            },function(er,foundUser) {
                if(foundUser) {
                    req.session.user = foundUser;

                    // TODO mandar algun mensajito flash diciendo que ya esta
                    res.redirect(303,'/');
                }
                else {
                    res.redirect(303,'/login');
                }
            });
        }
    });

    app.get('/registro',(req,res) => {
        if(req.session.user) {
            // TODO mandar algun mensajito flash diciendo que ya esta
            res.redirect(303,'/');
        }
        else {
            res.render('registro');
        }
    });
    app.post('/registro',(req,res) => {
        var targetUser = req.body.username.toLowerCase();

        db.collection('usuarios').findOne({
            username: targetUser
        },function(erFind,foundUser) {
            console.log(foundUser);

            if(foundUser) {
                // TODO mandar algun mensajito flash diciendo que ya esta
                res.redirect(303,'/login');
            }
            else {
                db.collection('usuarios').insert({
                    username: targetUser,
                    password: req.body.password
                }, function(erInsert,savedUser) {
                    // TODO mandar algun mensajito flash diciendo que ya esta
                    res.redirect(303,'/registro');
                });
            }
        });
    });

    app.get('/mensajes/crear',(req,res) => {
        if(req.session.user) {
            // TODO mandar algun mensajito flash diciendo que ya esta
            res.render('nuevo_mensaje');
        }
        else {
            res.redirect(303,'/');
        }
    });
    app.post('/mensajes/crear',(req,res) => {
        var usuario = req.session.user;

        db.collection('mensajes').insert({
            cuerpo: req.body.cuerpo_mensaje,
            user_id: new ObjectID(usuario._id),
            comentarios: []
        }, function(er,savedMsg) {
            // TODO mandar algun mensajito flash diciendo que ya esta
            res.redirect(303,'/');
        });
    });

    app.get('/mensajes/top5',(req,res) => {
        db.collection('mensajes').find({}).toArray(function(er,re) {
            if(er) res.send("Hubo un error");

            re.sort(function(doc1,doc2) {
                //descending
                return doc2.comentarios.length - doc1.comentarios.length;
                //ascending
                // return doc1.comentarios.length - doc2.comentarios.length;
            })

            res.render('top_mensajes',{
                mensajes: re.slice(0,5)
            });
        });
    });

    app.get('/mensajes/palabras',(req,res) => {

        var mapFunc = function() {
            var palabras_cuerpo = this.cuerpo.split(' ');

            for(var i=0; i<palabras_cuerpo.length; i++) {
                emit(palabras_cuerpo[i],1);
            }
        };

        var redFunc = function(key,values) {
            return values.length;
        };

        var o = {
            out: { replace: 'palabras_mas_repetidas' }
        };

        db.collection('mensajes').mapReduce(mapFunc,redFunc,o,function(er,coleccionResultante) {
            coleccionResultante.find().sort({
                'value': -1
            }).limit(15).toArray(function(er,re) {
                if(er) res.send("Hubo un error");

                res.render('palabras_mas_repetidas',{
                    palabras: re,
                    colorGenerator: function() {
                        var items = ["green","green lighten-2","green darken-1",
                                     "blue","blue lighten-2","red","red darken-3",
                                     "orange darken-2","grey","teal darken-2"];
                        return items[Math.floor(Math.random() * items.length)];
                    }
                });
            });
        });
    });

    app.get('/mensajes/comentar/:msg_id',(req,res) => {
        if(req.session.user) {
            var msg_id = req.params.msg_id;

            db.collection('mensajes').findOne({
                _id: new ObjectID(msg_id)
            },function(er,foundMsg) {
                res.render('comentar_mensaje',{
                    mensaje: foundMsg
                })
            });
        }
        else {
            res.redirect(303,'/');
        }
    });
    app.post('/mensajes/comentar',(req,res) => {
        var targetMsg = req.body.msg_id;
        var cuerpo = req.body.cuerpo_comentario;

        db.collection('mensajes').findOne({
            _id: new ObjectID(targetMsg)
        },function(erFind,foundMsg) {
            var nuevos_comentarios = foundMsg.comentarios;

            nuevos_comentarios.push({
                texto_comentario: cuerpo,
                creado: new Date(),
                user_id: req.session.user._id
            });

            db.collection('mensajes').findAndModify({
                _id: new ObjectID(targetMsg)
            },[
                ['_id','asc']
            ],{
                $set: {
                    comentarios: nuevos_comentarios
                }
            },function(erUpdate,re) {
                res.redirect(303,'/mensajes/'+targetMsg);
            });
        });
    });

    app.get('/mensajes/keyword/:palabra_clave',(req,res) => {
        var targetPalabra = req.params.palabra_clave;

        db.collection('mensajes').find({
            cuerpo: {
                $regex: new RegExp("(.*)"+targetPalabra+"(.*)",'i')
            }
        }).toArray(function(er,mensajesEncontrados) {
            if(er) res.send("Hubo un error");

            console.log(mensajesEncontrados);

            res.render('mensajes_palabra',{
                palabra: targetPalabra,
                mensajes: mensajesEncontrados
            });
        });
    });

    app.get('/mensajes/:msg_id',(req,res) => {
        var msg_id = req.params.msg_id;

        db.collection('mensajes').findOne({
            _id: new ObjectID(msg_id)
        },function(erMsg,foundMsg) {
            db.collection('usuarios').findOne({
                _id: new ObjectID(foundMsg.user_id)
            }, function(erUser,foundUser) {
                res.render('detalle_mensaje',{
                    mensaje: foundMsg,
                    usuario: foundUser
                });
            });
        });
    });

    app.get('/',(req,res) => {
        db.collection('mensajes').find().toArray(function(er,re) {
            if(er) res.send("Hubo un error");

            res.render('index',{
                mensajes: re
            });
        });
    });

    app.post('/logout', (req,res) => {
        if(req.session.user) {
            req.session.destroy(function(err) {
                res.redirect(303,'/');
            });
        }
        else {
            res.redirect(303,'/');
        }
    });
});
