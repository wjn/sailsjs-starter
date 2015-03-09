/**
 * UserController
 *
 * @description :: Server-side logic for managing users
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */
var bcrypt = require('bcrypt');

module.exports = {

  login: function (req, res) {
    User.findOneByEmail(req.body.email).exec(function (err, user) {
      if (err) res.serverError(err);

      if (user) {
        User.isValidPassword(req.body.password, user, function(err, match) {
          if (match) {
            // password match
            var token = TokenService.sign(user, req.body.ttl);

            delete user.password;
            delete user.verification_token;

            res.ok({user: user, token: token});
          } else {
            res.unauthorized()
          }
        });

      } else {
        res.unauthorized();
      }
    });
  },

  requestPasswordReset: function (req, res) {
    User.findOneByEmail(req.body.email).exec(function (err, user) {
      if (err) res.serverError(err);

      if (user) {
        // Create a verification token, which will expire in 2 hours
        user.verification_token = TokenService.sign({id: user.id}, 120);
        user.save()

        var templateData = {
          to: user.email,
          from: user.email,
          subject: sails.config.email.forgotPassword,
          userEmail: user.email,
          siteName: sails.config.project.name,
          url: sails.config.project.webUrl + sails.config.project.passwordReset.uri + user.verification_token
        };

        EmailService.sendMail(sails.config.project.passwordReset.template, templateData, function(err, message) {
          if (err) return sails.log('> error sending password reset email');
          sails.log('> sending password reset email to:', user.email);
        });

        res.status(204).json({});
      } else {
        res.notFound({ error: 'User not found' });
      }

    });
  },

  validatePasswordReset: function (req, res) {
    // Verify that the reset token has not expired
    TokenService.verify(req.params.token, function(err, data) {
      if(err) {
        res.serverError(err);
      } else {
        User.findOne({verification_token: req.params.token}).exec(function (err, user) {
          if (err){
            res.serverError(err);
          } else {
            if (user) {
              User.encryptPassword(req.body.password, function(err, encryptedPassword) {
                user.password = encryptedPassword;
                user.verification_token = null;
                user.save();
                res.status(204).json({});
              })
            } else {
              res.notFound({ error: 'User not found' });
            }
          }
        });
      }
    });
  }
}

