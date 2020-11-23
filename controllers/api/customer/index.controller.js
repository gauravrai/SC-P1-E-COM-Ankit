const model  = require('../../../models/index.model');
const config = require('../../../config/index');
const db 	   = config.connection;
const async = require("async");
const mongoose = require('mongoose');
const bcrypt = require("bcrypt-nodejs");
const moment = require('moment');
const jwt = require("jsonwebtoken");
const Messagetemplate = model.message_template;
const { validationResult } = require('express-validator')

//models import
const OTP     = model.otp;
const Customer     = model.customer;
const jwtSecret = config.constant.JWT_SECRET;
var http = require('http'),
    url = require('url');

module.exports = {
    // @route       GET api/v1/addcustomer
    // @description Customer login page check mobile number exists in otps collection, if yes update with new otp, if not intert mobile and new otp 
    // @access      Public
    addCustomer:async function(req,res){
        var mobile_number = req.body.mobile;
        const otp = Math.floor(1000 + Math.random() * 9000);

        const errors = validationResult(req)
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()})
        }

        try{
            
            let messageData = await Messagetemplate.findOne({slug: 'OTP-MESSAGE'});
            let slug = messageData.slug;
            let message = messageData.message;
            message = message.replace('[OTP]', otp);
            await config.helpers.sms.sendOTP(mobile_number, slug, message, async function (smsData) {
                const otpcheck = await OTP.findOne({mobile:mobile_number, status:true, deletedAt: 0});
                if(otpcheck) {
                    let otpData = {
                            otp  : otp
                    };
                    const numberInOtp = await OTP.updateOne(
                                                    {mobile: mobile_number},
                                                    {
                                                        $set: {
                                                            otp: otp
                                                        }
                                                    }
                                                )
                    
                    const getCustomer = await Customer.findOne({
                                                    mobile: mobile_number
                                                })
                    let profileUpdated = false
                    
                    if(getCustomer)
                        profileUpdated = true

                    const returnData = {
                                profileUpdated,                                
                            }
                    return res.status(200).json({ 
                                data: returnData, 
                                status: 'success', 
                                message: "Customer OTP and mobile number verified"
                            });                   
                } else {
                        const otpObj = new OTP({
                                                "mobile": mobile_number,
                                                otp
                                            });
                        otpObj.save()
                        return res.status(200).json({
                                        data: {
                                        profileUpdated: false
                                        }, 
                                        status: 'success', 
                                        message: "Customer added successfully"
                                });
                }
            });
        }
        catch (e){
            console.log(e)
            return res.status(500).json({ 
                status: 'error',
                errors: [{
                    msg: "Internal server error"
                }] 
            });
        }
          
    },
    // @route       GET api/v1/checkcustomerotp
    // @description Customer validate otp and mobile exists 
    // @access      Public
    checkCustomerOtp: async function(req, res) {

        const errors = validationResult(req)
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()})
        }

        const { mobile, otp } = req.body
        
        try{
            const customerCheck = await OTP.findOne({
                                            mobile,
                                            otp,
                                            status: true, 
                                            deletedAt: 0
                                        });
            
            if(customerCheck){
                const customer = await Customer.findOne({
                                                mobile,
                                                status: true, 
                                                deletedAt: 0
                                            });
                let profileUpdated = false
                if(customer)
                    profileUpdated = true

                const payload = {
                        mobile
                    }

                jwt.sign(payload, jwtSecret, {
                    expiresIn: 3600000
                }, (error, token) => {
                    if(error) throw error

                    return res.status(200).json({ 
                            data: {
                                customer,
                                profileUpdated,
                                token 
                            }, 
                            status: 'success', 
                            message: "Customer verification successfull!!"
                        });
                })
            }
            else{
               return res.status(400).json({ 
                                data: [],  
                                status: 'error', 
                                errors: [{
                                    msg: "Authentication failed"
                                }]
                            }); 
            }   
        }
        catch (e){
            console.log(e)
            return res.status(500).json({ 
                                    data: [],  
                                    status: 'error', 
                                    errors: [{
                                        msg: "Internal server error"
                                    }]
                                });
        }
           
    },
    customer: async function( req, res ) {

        const customercheck = await Customer.findOne({
                                        mobile: req.user.mobile,
                                        status: true, 
                                        deletedAt: 0
                                    })
                                    .select('-deletedAt');
        let message = "Data not found"
        if(customercheck) {
            message = "Customer data found"
        }
        return res.status(200).json({ 
                                data: customercheck, 
                                status: 'success', 
                                message
                            });
        
    },
    updateCustomer: async function( req, res ) {
        
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()})
        }


        const { mobile, name, email, address } = req.body
        
        let CustomerData = {
            name : name,
            email : email,
            address : address
        };
        try {
            const customer = await Customer.findOne({
                mobile: req.user.mobile
            })
            
            if(!customer){
                //update the customer profile
                const customerPObj = await new Customer({
                                            name,
                                            "mobile": req.user.mobile,
                                            email,
                                            address
                                        });
                customerPObj.save()
                return res.status(200).json({
                                data: customerPObj,
                                status: 'success', 
                                message: "Customer profile added successfully!!"
                            });
            }
            else{
                //insert new customer profile
                await Customer.updateOne({ 
                    mobile: req.user.mobile 
                },
                CustomerData, function( err, data ){
                    if(err) console.log(err)

                    return res.status(200).json({
                                data: CustomerData,
                                status: 'success', 
                                message: "Customer profile updated successfully!!"
                            }); 
                })
            }
            
        }
        catch (e){
            console.log(e)
            return res.status(500).json({ 
                                    data: [],  
                                    status: 'error', 
                                    errors: [{
                                        msg: "Internal server error"
                                    }]
                                });
        }
        
    },

	updateAddress: async function(req,res) {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()})
        }
        try{
            let userId = req.body.userId;
            let userData = {
                address : req.body.address ? req.body.address : '',
                country : req.body.country ? req.body.country : '',
                stateId : req.body.stateId ? mongoose.mongo.ObjectID(req.body.stateId) : '',
                cityId : req.body.cityId ? mongoose.mongo.ObjectID(req.body.cityId) : '',
                pincodeId : req.body.pincodeId ? mongoose.mongo.ObjectID(req.body.pincodeId) : '',
                areaId: req.body.areaId ? mongoose.mongo.ObjectID(req.body.areaId) : '',
                societyId : req.body.societyId ? mongoose.mongo.ObjectID(req.body.societyId) : '',
                towerId : req.body.towerId ? mongoose.mongo.ObjectID(req.body.towerId) : ''
            };
            let updateUserData = await Customer.update({_id:mongoose.mongo.ObjectID(userId)},userData);
            return res.status(200).json({ 
                data: [], 
                status: 'success', 
                message: "Customer Address been updated successfully!!" 
            });	
        }
        catch (e){
            console.log(e)
            return res.status(500).json({ 
                                    data: [],  
                                    status: 'error', 
                                    errors: [{
                                        msg: "Internal server error"
                                    }]
                                });
        }
	},
    
	getUserData: async function(req,res) {
        const errors = validationResult(req)
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()})
        }
        try{
            let data = {};
            let userId = req.body.userId;
            let condition = {_id: mongoose.mongo.ObjectId(userId)};
            let userData = await Customer.findOne(condition);
            data.name = userData.name ? userData.name : '';
            data.email = userData.email ? userData.email : '';
            data.address = userData.address ? userData.address : '';
            data.mobile = userData.mobile ? userData.mobile : '';
            data.country = userData.country ? userData.country : '';
            await config.helpers.state.getNameById(userData.stateId, async function (stateName) {
                data.state = stateName.name;
            })
            await config.helpers.city.getNameById(userData.cityId, async function (cityName) {
                data.city = cityName.name;
            })
            await config.helpers.pincode.getNameById(userData.pincodeId, async function (pincode) {
                data.pincode = pincode.pincode;
            })
            await config.helpers.area.getNameById(userData.areaId, async function (areaName) {
                data.area = areaName.name;
            })
            await config.helpers.society.getNameById(userData.societyId, async function (societyName) {
                data.society = societyName.name;
            })
            await config.helpers.tower.getNameById(userData.towerId, async function (towerName) {
                data.tower = towerName.name;
            })
            if(data) {
                return res.status(200).json({ 
                    data: data, 
                    status: 'success', 
                    message: "User data found successfully!!" 
                });	
            }else {
                return res.status(400).json({ 
                    data: [], 
                    status: 'success', 
                    message: "User data not found!!" 
                });	
            }
        }
        catch (e){
            console.log(e)
            return res.status(500).json({ 
                                    data: [],  
                                    status: 'error', 
                                    errors: [{
                                        msg: "Internal server error"
                                    }]
                                });
        }
	}
	
}