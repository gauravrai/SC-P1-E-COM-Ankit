var indexController = require('../../controllers/api/order/index.controller');
var config = require('../../config/index');
const auth = require('../../middleware/check-auth-jwt');
const { check } = require('express-validator')

module.exports = function(router) {
  	router.post(
		config.constant.APIURL+'/placeOrder', 
		[
			auth,
			[
				check('cartId', 'Cart Id is required').not().isEmpty(),
				check('userId', 'User Id is required').not().isEmpty(),
				check('paymentType', 'Payment Type is required').not().isEmpty(),
				check('orderFrom', 'Order From is required').not().isEmpty()
			]
		],
		indexController.placeOrder
	); 
}