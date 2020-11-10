const model  = require('../../../models/index.model');
const config = require('../../../config/index');
const db 	   = config.connection;
const async = require("async");
const mongoose = require('mongoose');
const bcrypt = require("bcrypt-nodejs");
const moment = require('moment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Admin = model.admin;
const Category = model.category;
const SubCategory = model.sub_category;
const Store = model.store;
const Product = model.product;
const Stock = model.stock;
const Brand   = model.brand;
const StockEntries = model.stock_entries;
const Varient   = model.varient;
const ADMINCALLURL = config.constant.ADMINCALLURL;

module.exports = {

    manageStock: async function(req,res){
		let moduleName = 'Stock Management';
		let pageTitle = 'Manage Stock';
		await config.helpers.permission('manage_stock', req, (err,permissionData)=>{
			res.render('admin/stock/view.ejs',{layout:'admin/layout/layout', pageTitle:pageTitle, moduleName:moduleName, permissionData:permissionData});
		});
	},
	
	listStock:function(req,res){
		var search = {deletedAt:0}
		let searchValue = req.body.search.value;
		if(searchValue){			
            search.name = { $regex: '.*' + searchValue + '.*',$options:'i' };
		}
		
		let skip = req.input('start') ? parseInt(req.input('start')) : 0;
		let limit= req.input('length') ? parseInt(req.input('length')) : config.constant.LIMIT;
		async.parallel({
		    count:function(callback) {
		        Stock.countDocuments(search).sort({'createdAt' : -1}).exec(function(err,data_count){
		        	callback(null,data_count)
		        })
		    },
		    data:function(callback) {		    
		    	Stock.find(search).skip(skip).limit(limit).sort({'createdAt' : -1}).exec(function(err,data){
		        	callback(null,data)
		        })		        
		    }
		},		
		async function(err, results) {
		   	var obj = {};
			obj.draw = req.body.draw;
			obj.recordsTotal = results.count?results.count:0;
			obj.recordsFiltered =results.count?results.count:0;
			var data = results.data?results.data:[];
			var arr =[];
            var perdata = {add:1,edit:1,delete:1}

			await config.helpers.permission('manage_stock', req, async function(err,permissionData) {
				for(i=0;i<data.length;i++){
					var arr1 = [];
					await config.helpers.product.getNameById(data[i].productId, async function (productName) {
						var product_name = productName ? productName.name : 'N/A';
						arr1.push(product_name);
					})
					await config.helpers.varient.getNameById(data[i].varientId, async function (varientName) {
						var varient_name = varientName ? varientName.label+' '+varientName.measurementUnit : 'N/A';
						arr1.push(varient_name);
					})
					arr1.push(data[i].count);
					await config.helpers.store.getNameById(data[i].storeId, async function (storeName) {
						var store_name = storeName ? storeName.name : 'N/A';
						arr1.push(store_name);
					});
					arr1.push(moment(data[i].createdAt).format('DD-MM-YYYY'));
					if(!data[i].status){
						let change_status = "changeStatus(this,\'1\',\'change_status_stock\',\'list_stock\',\'stock\');";	
						arr1.push('<span class="badge bg-danger" style="cursor:pointer;" onclick="'+change_status+'" id="'+data[i]._id+'">Inactive</span>');
					}else{
						let change_status = "changeStatus(this,\'0\',\'change_status_stock\',\'list_stock\',\'stock\');";
						arr1.push('<span class="badge bg-success" style="cursor:pointer;" onclick="'+change_status+'" id="'+data[i]._id+'">Active</span>');
					}
					let $but_edit = '-';
					if(permissionData.edit=='1'){
					$but_edit = '<span><a href="'+ADMINCALLURL+'/edit_stock?id='+data[i]._id+'" class="btn btn-flat btn-info btn-outline-primary" title="Edit"><i class="fas fa-edit"></i></a></span>';
					}
					let $but_delete = ' - ';
					if(permissionData.delete =='1'){
						let remove = "deleteData(this,\'delete_stock\',\'list_stock\',\'stock\');";
						$but_delete = '&nbsp;&nbsp;<span><a href="javascript:void(0)" class="btn btn-flat btn-info btn-outline-danger" title="Delete" onclick="'+remove+'" id="'+data[i]._id+'"><i class="fas fa fa-trash" ></i></a></span>';
					}
					arr1.push($but_edit+$but_delete);
					arr.push(arr1);
				}
				obj.data = arr;
				res.send(obj);
			});
		});
	},
    
    addStock: async function(req,res){
		if(req.method == "GET"){
			let moduleName = 'Stock Management';
			let pageTitle = 'Add Stock';
			let productData = await Product.find({status:true, deletedAt: 0});
			let storeData = await Store.find({status:true, deletedAt: 0});
			let varientData = await Varient.find({status:true, deletedAt: 0});
			res.render('admin/stock/add.ejs',{layout:'admin/layout/layout', pageTitle:pageTitle, moduleName:moduleName, storeData:storeData, productData:productData, varientData:varientData });
		}else
		{
			const { productId, varient, count, costPrice, storeId, transactionType } = req.body;

			const stockData = await Stock.findOne({
				status: true, deletedAt: 0, productId: mongoose.mongo.ObjectId(productId), varient, storeId: mongoose.mongo.ObjectId(storeId),
			});
			if ((!stockData && transactionType === 'out') || (stockData && transactionType === 'out' && (parseInt(stockData.count) - parseInt(count)) < 0)) {
				req.flash('msg', {msg:'Not enough stock available', status:false});
				res.redirect(config.constant.ADMINCALLURL+'/add_stock');
			} else {
				if (stockData) {
					const countToUpdate = transactionType === 'in' 
						? (parseInt(stockData.count) + parseInt(count))
						: (parseInt(stockData.count) - parseInt(count))
					await Stock.updateOne(
						{ productId: mongoose.mongo.ObjectId(productId), storeId: mongoose.mongo.ObjectId(storeId), varientId, status: true, deletedAt: 0, },
						{ count: countToUpdate },
						function(err,data){
							if(err){console.log(err)}
						})
				} else {
					const stock = new Stock({ productId: mongoose.mongo.ObjectId(productId), count, varientId, storeId: mongoose.mongo.ObjectId(storeId), });
					stock.save(function(err, data){
					if(err){console.log(err)}	
					});
				}
	
				const stockEntries = new StockEntries({
					productId: mongoose.mongo.ObjectId(productId), count, varientId, costPrice, storeId:mongoose.mongo.ObjectId(storeId), transactionType,
				});
				stockEntries.save(function(err, data){
					if(err){console.log(err)}	
				});
				req.flash('msg', {msg:'Stock Added Successfully', status:false});	
				res.redirect(config.constant.ADMINCALLURL+'/manage_stock');
				req.flash({});
			}
		}
	},

	editStock: async function(req,res){
		if(req.method == "GET"){
			let moduleName = 'Stock Management';
			let pageTitle = 'Edit Stock';
			let id = req.body.id;
			let categoryData = await Category.find({status:true, deletedAt: 0});
			let storeData = await Store.find({status:true, deletedAt: 0});
			let subcategoryData = await SubCategory.find({status:true, deletedAt: 0});
			let brandData       = await Brand.find({status:true, deletedAt: 0});
			let productData = await Stock.findOne({_id: mongoose.mongo.ObjectId(id), deletedAt: 0});
			res.render('admin/stock/edit',{layout:'admin/layout/layout', pageTitle:pageTitle, moduleName:moduleName, categoryData:categoryData, subcategoryData:subcategoryData, storeData:storeData, brandData:brandData, productData:productData} );
		}
		if(req.method == "POST"){
			let productData = {};
			productData = {	
				categoryId : mongoose.mongo.ObjectId(req.body.categoryId),
				subcategoryId : mongoose.mongo.ObjectId(req.body.subcategoryId),
				name : req.body.name,
				brandId : mongoose.mongo.ObjectId(req.body.brandId),
				offer : req.body.offer,
				discount: req.body.discount,
				stock : req.body.stock ? req.body.stock.toUpperCase() : '',
				description : req.body.description,
				featured : req.body.featured == 'on' ? true : false,
				outOfStock : req.body.outOfStock == 'on' ? true : false
			};
			let store = req.body.store;
			let storeId = req.body.storeId;
			let inventory = [];
			let price = 0;
			for (let i = 0; i < store; i++) {
				let labelArr = req.body['label_'+i];
				let weightArr = req.body['weight_'+i];
				let priceArr = req.body['price_'+i];
				let defaultArr = req.body['default_'+i];
				let storeData = [];
				if(labelArr.length > 0)
				{
					for (let j = 0; j < labelArr.length; j++) {
						if(labelArr[j] != '' && weightArr[j] != '' && priceArr[j] != '')
						{
							let storeFieldObj = {
								storeId: mongoose.mongo.ObjectID(storeId[i]),
								label : labelArr[j],
								weight : weightArr[j],
								price : priceArr[j],
								default : defaultArr == j ? true : false
							};
							if(defaultArr == j)
							{
								price = priceArr[j];
							}
							storeData.push(storeFieldObj);
						}
					}
				}else
				{
					let storeFieldObj = {
						storeId: mongoose.mongo.ObjectID(storeId[i]),
						label : '',
						weight : '',
						price : '',
						default : false
					};
					storeData.push(storeFieldObj);
				}
				inventory.push(storeData);
			}
			productData.inventory = inventory;
			productData.price = price;
			if(Object.keys(req.files).length !== 0)
			{
				let imageLength = req.body.imageLength;
				let thumbnailArr = [];
				let smallArr = [];
				let largeArr = [];
				for (let i = 0; i <= imageLength.length; i++) {
					let thumbnail = req.files['thumbnail_'+i];
					let small = req.files['small_'+i];
					let large = req.files['large_'+i];
					new Promise(function(resolve, reject) { 
						if(typeof thumbnail != 'undefined')
						{
							let thumbnailPath = config.constant.PRODUCTTHUMBNAILUPLOADPATH;
							let thumbnailName = Date.now()+'_'+thumbnail.name;
							thumbnailArr[i] = thumbnailName;
							thumbnail.mv(thumbnailPath+thumbnailName, function(err,data) {
								if (err) { 
									console.log(err)
									reject(err); 
								} else {  
									resolve();
								}
							})
						}
						else
						{
							thumbnailArr[i] = req.body.thumbnailhidden[i];
							resolve();
						}
					}).then(async () => { 
						new Promise(function(resolve1, reject1) { 
							if(typeof small != 'undefined')
							{
								let smallPath = config.constant.PRODUCTSMALLUPLOADPATH;
								let smallName = Date.now()+'_'+small.name;
								smallArr[i] = smallName;
								small.mv(smallPath+smallName, function(err,data) {
									if (err) { 
										console.log(err)
										reject1(err); 
									} else {  
										resolve1();
									}
								})
							}
							else
							{
								smallArr[i] = req.body.smallhidden[i];
								resolve1();
							}
						}).then(async () => { 
							new Promise(function(resolve2, reject2) {
								if(typeof large != 'undefined')
								{
									let largePath = config.constant.PRODUCTLARGEUPLOADPATH;
									let largeName = Date.now()+'_'+large.name;
									largeArr[i] = largeName;
									large.mv(largePath+largeName, function(err,data) {
										if (err) { 
											console.log(err)
											reject2(err); 
										} else {  
											resolve2();
										}
									})
								}
								else
								{
									largeArr[i] = req.body.largehidden[i];
									resolve2();
								}
							}).then(async () => {
								let data = {}
								let image = {
									'thumbnail' : thumbnailArr,
									'small' : smallArr,
									'large' : largeArr
								}
								data.image = image;
								await Stock.updateOne(
									{ _id: mongoose.mongo.ObjectId(req.body.id) },
									data, function(err,data){
										if(err){console.log(err)}
								})
							});
						})
					}).catch((err) => {
						console.log(err);
					});
				}
			}
			await Stock.update(
				{ _id: mongoose.mongo.ObjectId(req.body.id) },
				productData, function(err,data){
					if(err){console.log(err)}
					req.flash('msg', {msg:'Stock has been Updated Successfully', status:false});	
					res.redirect(config.constant.ADMINCALLURL+'/manage_stock');
					req.flash({});	
			})
		}		
    },

	changeStatusStock: function(req,res){
		let id = req.param("id");
		let status = req.param("status");
		return Stock.updateOne({_id: mongoose.mongo.ObjectId(id)}, {
			status: parseInt(status)?true:false
		},function(err,data){
			if(err) console.error(err);
			if(status == '1'){
				let change_status = "changeStatus(this,\'0\',\'change_status_stock\',\'list_stock\',\'product\');";
				res.send('<span class="badge bg-success" style="cursor:pointer;" onclick="'+change_status+'">Active</span>');
			}
			else{
				let change_status = "changeStatus(this,\'1\',\'change_status_stock\',\'list_stock\',\'product\');";	
				res.send('<span class="badge bg-danger" style="cursor:pointer;" onclick="'+change_status+'">Inactive</span>');
			}
	    })
	},
	deleteStock: async function(req,res){
		let id = req.param("id");
		return Stock.updateOne({_id:  mongoose.mongo.ObjectId(id)},{deletedAt:2},function(err,data){        	
			if(err) console.error(err);
        	res.send('done');
        })
	},
	checkStockkeeping : async function(req,res){
		   let stockkeeping  = req.body.stock_keeping;
		   let productData = await Stock.find({stock_keeping:stockkeeping, status:true, deletedAt: 0});
		   if(productData.length>0){
			   return res.status(200).json({ code:1 , status: 'exists', message: "Stock Keeping Unit Already Inserted !!"});
		   } else {
			return res.status(200).json({ code:0 , status: '', message: "" });
		   }
	},
	transferStock: async function(req,res){
		if(req.method == "GET"){
			let moduleName = 'Stock Management';
			let pageTitle = 'Transfer Stock';
			let productData = await Product.find({status:true, deletedAt: 0});
			let storeData = await Store.find({status:true, deletedAt: 0});
			res.render('admin/stock/transfer.ejs',{layout:'admin/layout/layout', pageTitle:pageTitle, moduleName:moduleName, storeData:storeData, productData:productData });
		}
		if (req.method === 'POST') {
			const { productId, varient, count, toStoreId, fromStoreId } = req.body;
			const fromStoreData = await Stock.findOne({
				status: true, deletedAt: 0, productId: mongoose.mongo.ObjectId(productId), varient, storeId: mongoose.mongo.ObjectId(fromStoreId),
			});
			if (!fromStoreData || (fromStoreData && (parseInt(fromStoreData.count) - parseInt(count)) < 0) ) {
				req.flash('msg', {msg:'Not enough stock available', status:false});
				res.redirect(config.constant.ADMINCALLURL+'/transfer_stock');
			} else {
				const toStoreData = await Stock.findOne({
					status: true, deletedAt: 0, productId: mongoose.mongo.ObjectId(productId), varient, storeId: mongoose.mongo.ObjectId(toStoreId),
				});
				const updatedStockFromStore = Stock.updateOne(
					{ productId: mongoose.mongo.ObjectId(productId), storeId: mongoose.mongo.ObjectId(fromStoreId), varient, status: true, deletedAt: 0, },
					{ count: parseInt(fromStoreData.count) - parseInt(count) });
				const updatedStockToStore = Stock.updateOne(
					{ productId: mongoose.mongo.ObjectId(productId), storeId: mongoose.mongo.ObjectId(toStoreId), varient, status: true, deletedAt: 0, },
					{ count: toStoreData ? (parseInt(toStoreData.count) + parseInt(count)) : parseInt(count) },
					{ upsert: true },
				);
				const stockEntriesData = StockEntries.findOne({ productId: mongoose.mongo.ObjectId(productId), storeId: mongoose.mongo.ObjectId(fromStoreId), varient, status: true, deletedAt: 0, },)

				const [stockEntryData] = await Promise.all([stockEntriesData, updatedStockFromStore, updatedStockToStore]);
				await StockEntries.insertMany([
					{
						productId: mongoose.mongo.ObjectId(productId), count: (parseInt(fromStoreData.count) - parseInt(count)), varient, costPrice: stockEntryData.costPrice, storeId:mongoose.mongo.ObjectId(fromStoreId), transactionType: 'out',
					},
					{
						productId: mongoose.mongo.ObjectId(productId), count: (toStoreData ? (parseInt(toStoreData.count) + parseInt(count)) : parseInt(count) ), varient, costPricricee: stockEntryData.costPrice, storeId:mongoose.mongo.ObjectId(toStoreId), transactionType: 'in',
					},
				]);
				req.flash('msg', {msg:'Stock transferred successfully', status:false});	
				res.redirect(config.constant.ADMINCALLURL+'/manage_stock');
				req.flash({});
			}

		}
	},
}