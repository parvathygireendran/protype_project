sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/odata/v2/ODataModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageToast",
	"sap/m/MessagePopover",
	"sap/m/MessageItem",
	"sap/m/MessageBox",
	"sap/m/MessageView",
	"sap/ui/core/BusyIndicator"
], function (Controller, JSONModel, ODataModel, Filter, FilterOperator, MessageToast, MessagePopover, MessageItem, MessageBox,
	MessageView, BusyIndicator) {
	"use strict";

	// Constants pointing to the services used for saving and posting the invoice
	var SAVE_INVOICE_SERVICE = "/HDB_SCP/com/deloitte/apps/invoiceprocessor/services/saveInvoice/saveInvoice.xsjs";
	var POST_INVOICE_SERVICE = "/HDB_SCP/com/deloitte/apps/invoiceprocessor/services/postInvoice/postInvoice.xsjs";
	var CAPTURE_REJECTCOMMENT_SERVICE = "/HDB_SCP/com/deloitte/apps/invoiceprocessor/services/workflowResponse/workflowResponse.xsjs";
	var POST_PENDING_APPROVAL_STATUS_onSubmit = "/HDB_SCP/com/deloitte/apps/invoiceprocessor/services/workflowResponse/statusPendingApproval.xsjs";
	
	var APPROVER_ROLE = "approver";
	// var sTaskId = "approver";

	var oMessageTemplate = new MessageItem({
		type: '{type}',
		title: '{title}',
		subtitle: '{description}',
		description: '{description}'
	});
	var _hasExceptions = false;
	var _formData = null;

	var oMessagePopover = new MessagePopover({
		items: {
			path: '/',
			template: oMessageTemplate
		}
	});

	return Controller.extend("com.deloitte.scp.app.InvoiceProcessornew.controller.InvoiceDetail", {

		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf com.deloitte.scp.app.InvoiceProcessor.view.InvoiceDetail
		 */
		onInit: function () {

			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			oRouter.getRoute("toInvoiceDetail").attachMatched(this._onHandleNavFromList, this);

			var invoiceDetails = this.getView().getModel("invoiceDetails");
			// this.byId("btnSubmit").setEnabled(false);
			// var fileName = "{invoiceDetails>/invoiceFileName}";
			// var fileExtension = fileName.replace(/^.*\./, '');

		},

		/**
		 * Called while navigation from the list to the object page has been completed. 
		 * This handler makes retrieves details of the individual invoice and populates it in the respective fields
		 **/
		_onHandleNavFromList: function (oEvent) {
			this.byId("btnCancel").setVisible(false);
			this.byId("btnSave").setVisible(true);
			this.byId("btnApprove").setVisible(false);
			this.byId("btnReject").setVisible(false);
			// this.byId("btnSubmit").setEnabled(false);

			// Show the busy indicator while retrieving and loading the invoice details
			BusyIndicator.show(0);

			var uriParameters = oEvent.getParameter("arguments");

			// Get the PONumber and make poItemTab or nonpoItemtab visible depending on selection of the invoice from the list - Initial load of Detail view
			// var poNumber = sap.ui.getCore().purchaseOrder;
			if (sap.ui.getCore().purchaseOrder !== "") {
				this.byId("nonpoItemTab").setVisible(false);
				this.byId("poItemTab").setVisible(true);

			} else {
				this.byId("nonpoItemTab").setVisible(true);
				this.byId("poItemTab").setVisible(false);
			}

			// // Disp Fragment - Get the PONumber and make poItemTab or nonpoItemtab visible
			// var poNumber = sap.ui.getCore().purchaseOrder;
			if (this.byId("nonpoItemTabDisp")) {
				if (sap.ui.getCore().purchaseOrder === "") {
					this.byId("nonpoItemTabDisp").setVisible(true);
					this.byId("poItemTabDisp").setVisible(false);

				} else {
					this.byId("nonpoItemTabDisp").setVisible(false);
					this.byId("poItemTabDisp").setVisible(true);
				}
			}
			if (this.byId("poItemTabDisp")) {
				if (sap.ui.getCore().purchaseOrder === "") {
					this.byId("nonpoItemTabDisp").setVisible(true);
					this.byId("poItemTabDisp").setVisible(false);

				} else {
					this.byId("nonpoItemTabDisp").setVisible(false);
					this.byId("poItemTabDisp").setVisible(true);
				}

			}
			// }

			// Get the invoiceGUID and invoiceID transferred from the list page
			var invoiceGUID = uriParameters.invoiceGUID;
			sap.ui.getCore().invoiceGUIDFromList = uriParameters.invoiceGUID;
			var invoiceStatus = sap.ui.getCore().invoiceStatus;

			if (invoiceStatus == "In_Progress") {
				this.byId("btnSave").setEnabled(false);
			} else
				this.byId("btnSave").setEnabled(true);
				
			if (invoiceStatus == "Pending_Approval") {
				this._allowInvoiceModification(false);
				// this.byId("btnSave").setEnabled(false);
				// this.byId("btnEdit").setEnabled(false);
				// this.byId("btnSubmit").setEnabled(false);
				} 

			// Get the model of the current view and generate an odata model using its service url
			var oInvoiceDetailsModel = this.getOwnerComponent().getModel();
			var oODataModel = new ODataModel(oInvoiceDetailsModel.sServiceUrl);

			var currentViewController = this;
			var invoiceDetailsJSON;

			oODataModel.read("/Invoice(invoiceGUID='" + invoiceGUID + "')", {

				// Get the response formatted as a JSON response and have the items association expanded
				urlParameters: {
					"$format": "json",
					"$expand": "items"
				},
				// make async false to wait for ajax response
				async: false,

				success: function (data, response) {

					// Parse the JSON response and generate a corresponding JSON model
					invoiceDetailsJSON = JSON.parse(JSON.stringify(data));
					invoiceDetailsJSON.nonPO = [{
						invoiceItemIndex: 1,
						companyCode: invoiceDetailsJSON.companyCode,
						glAccount: invoiceDetailsJSON.glAccount,
						glDescription: invoiceDetailsJSON.glDescription,
						costCenter: invoiceDetailsJSON.costCenter,
						wbsElement: invoiceDetailsJSON.wbsElement,
						internalOrder: invoiceDetailsJSON.internalOrder,
						netAmount: invoiceDetailsJSON.netAmount
					}];

					_formData = JSON.stringify(invoiceDetailsJSON);
					var loadExceptionStatus = null;
					var invoiceDetails = new JSONModel(invoiceDetailsJSON);

					//Setting PO number to check for PO and NonPO for tabs
					sap.ui.getCore().poNumDetailSceenFromWF = invoiceDetailsJSON.purchaseOrder;

					// Set the JSON model as the data model for the current view
					currentViewController.getView().setModel(invoiceDetails, "invoiceDetails");

					// Set the status indicator accordingly
					currentViewController._setStatusIndicator(invoiceDetailsJSON.invoiceStatus);

					//Send data to WF Obj OR Check the status for selected invoice
					var contextData = {};
					contextData = invoiceDetailsJSON;
					sap.ui.getCore().invoiceDetailsWF = contextData; //invoiceDetailsWF - To be used in WF call

					// hide the busy indicator, once the view has been updated completely
					BusyIndicator.hide();

					// If the invoice is already posted, disable making any changes to it.
					// If not posted, allow changes and fetch the exceptions, if any, corresponding to the invoice
					if (invoiceDetailsJSON.postedInvoice || invoiceDetailsJSON.invoiceStatus === "Pending_Approval") {
						currentViewController._allowInvoiceModification(false);
						if (currentViewController.getCurrentUserRole() === APPROVER_ROLE) {
							currentViewController.onPageLoadForWorkflow();

						}

						//if the invoice is not even saved once, disable submit button
						if (invoiceDetailsJSON.invoiceStatus === "Scanned" 
							|| invoiceDetailsJSON.invoiceStatus === "Posted" 
							|| invoiceDetailsJSON.invoiceStatus === "Pending_Approval") {
							currentViewController.byId("btnSubmit").setEnabled(false);
						}

					} else {
						currentViewController._allowInvoiceModification(true);
						loadExceptionStatus = currentViewController._loadExceptions(oInvoiceDetailsModel, invoiceGUID);

						loadExceptionStatus.done(function () {

							if (currentViewController.getCurrentUserRole() === APPROVER_ROLE) {

								currentViewController.onPageLoadForWorkflow();

							}

						});
					}
				}

			});

		},

		getFileDescription: function () {
			var image = document.getElementById("image11");
			if ('mimeType' in image) {
				MessageBox.error(image.mimeType);
			} else {
				MessageBox.error("Your browser doesn't support the mimeType property.");
			}
		},

		_setStatusIndicator: function (invoiceStatus) {
			var statusIndicator = this.getView().byId("invoiceStatusIndicatorBox");

			var statusIndicatorText = statusIndicator.getItems()[0];
			var statusIndicatorPF = statusIndicator.getItems()[1];

			switch (invoiceStatus) {
			case "Scanned":
				statusIndicatorText.setText("Scanned");
				statusIndicatorText.setIcon("sap-icon://document-text");
				statusIndicatorText.setState(sap.ui.core.ValueState.Success);

				var documentScanState = sap.ui.core.ValueState.Success;
				var inProcessState = sap.ui.core.ValueState.None;
				var invoicePostedStatus = sap.ui.core.ValueState.None;
				this.byId("btnSubmit").setEnabled(false);
				break;

			case "In_Progress":
				statusIndicatorText.setText("In Progress");
				statusIndicatorText.setIcon("sap-icon://process");
				statusIndicatorText.setState(sap.ui.core.ValueState.Warning);

				documentScanState = sap.ui.core.ValueState.Success;
				inProcessState = sap.ui.core.ValueState.Warning;
				invoicePostedStatus = sap.ui.core.ValueState.None;

				this.byId("btnSave").setEnabled(false);
				this.byId("btnSubmit").setEnabled(true);

				break;
				
			case "Pending_Approval":
				statusIndicatorText.setText("Pending Approval");
				statusIndicatorText.setIcon("sap-icon://process");
				statusIndicatorText.setState(sap.ui.core.ValueState.Warning);

				documentScanState = sap.ui.core.ValueState.Success;
				inProcessState = sap.ui.core.ValueState.Warning;
				invoicePostedStatus = sap.ui.core.ValueState.None;

				this.byId("btnSave").setEnabled(false);
				this.byId("btnEdit").setEnabled(false);
				this.byId("btnSubmit").setEnabled(false);

				break;

			case "Posted":
				statusIndicatorText.setText("Posted");
				statusIndicatorText.setIcon("sap-icon://accounting-document-verification");
				statusIndicatorText.setState(sap.ui.core.ValueState.Warning);

				documentScanState = sap.ui.core.ValueState.Success;
				inProcessState = sap.ui.core.ValueState.Success;
				invoicePostedStatus = sap.ui.core.ValueState.Success;
				this.byId("btnSubmit").setEnabled(false);
				break;

			default:
				statusIndicatorText.setText("");
				statusIndicatorText.setIcon("sap-icon://document-text");
				statusIndicatorText.setState(sap.ui.core.ValueState.None);

				var documentScanState = sap.ui.core.ValueState.None;
				var inProcessState = sap.ui.core.ValueState.None;
				var invoicePostedStatus = sap.ui.core.ValueState.None;
				break;
			}

			var statusIndContent = statusIndicatorPF.getContent();
			statusIndContent[0].setState(documentScanState);
			statusIndContent[1].setState(inProcessState);
			statusIndContent[2].setState(invoicePostedStatus);

		},

		_allowInvoiceModification: function (isModificationAllowed) {

			if (isModificationAllowed) {

				// Enable the buttons to save, edit, submit the invoice
				this.byId("btnSave").setEnabled(true);
				this.byId("btnEdit").setEnabled(true);
				// this.byId("btnSubmit").setEnabled(false);

				// Also, enable the button, displaying the exceptions message pop over
				this.byId("btnExceptions").setEnabled(true);

			} else {

				// Disable the buttons to save, edit, submit the invoice
				this.byId("btnSave").setEnabled(false);
				this.byId("btnEdit").setEnabled(false);
				// this.byId("btnSubmit").setEnabled(false);

				// Also, disable the button, displaying the exceptions message pop over
				this.byId("btnExceptions").setEnabled(false);

			}

		},

		// onBackButtonPress: function () {
		// 	this.onHandleCancelPress();
		// 	var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
		// 	oRouter.navTo("toInvoiceList");
		// },

		// fnImageFmtr: function (value) {
		// 	var imgSrc = value;
		// 	return imgSrc;
		// },

		// onExit: function () {

		// 	this.onHandleCancelPress();
		// 	for (var sPropertyName in this._formFragments) {
		// 		if (!this._formFragments.hasOwnProperty(sPropertyName) || this._formFragments[sPropertyName] == null) {
		// 			return;

		// 		//if the invoice is not even saved once, disable submit button
		// 		if (invoiceDetailsJSON.invoiceStatus === "Scanned") {
		// 			currentViewController.byId("btnSubmit").setEnabled(false);

		// 		}

		// 		//Send data to WF Obj
		// 		var contextData = {};
		// 		contextData = invoiceDetailsJSON;
		// 		sap.ui.getCore().invoiceDetailsWF = contextData; /*invoiceDetailsWF - To be used in WF call*/
		// 		// hide the busy indicator, once the view has been updated completely
		// 		BusyIndicator.hide();
		// 	}
		// }
		// },

		error: function (error) {
			// Hide the busy indicator and display the error returned from the service
			BusyIndicator.hide();
			MessageBox.error("Error: " + error.toString());
		},
		// });

		// },

		// Get Current user Role
		getCurrentUserRole: function () {

			var roleParameterValueTemp = location.href.split("&role=");
			var sTaskTemp = roleParameterValueTemp[0].split("?TaskID=");
			var iGUIDTemp = sTaskTemp[0].split("Invoice/");
			// sap.ui.getCore.sTask = sTaskTemp[1];
			if (roleParameterValueTemp[1] && roleParameterValueTemp[1].toLowerCase() === APPROVER_ROLE) {
					// this.getCurrentWFTask();
					sap.ui.getCore.sTask = sTaskTemp[1];// Capture Task ID from WF Invoice Link
					sap.ui.getCore.iGUIDFromWFTask = iGUIDTemp[1];// Capture invoiceGUID from WF Invoice Link
					return APPROVER_ROLE;
				}
			/*if(roleParameterValueTemp[1] && roleParameterValueTemp[1].toLowerCase() !== APPROVER_ROLE){
				// var roleParameterValue = roleParameterValueTemp[1].split("&TaskID=");
				// if (roleParameterValue && roleParameterValue[0] && roleParameterValue[0].toLowerCase() === APPROVER_ROLE) {
				// 	return APPROVER_ROLE;
				// }
				this.getCurrentWFTask();
				
			}*/
			

			// return "";

		},

		// Get Current WF Task ID
		getCurrentWFTask: function () {
			// var roleParameterValue = location.href.split("?role=");
			var sTask = location.href.split("&TaskID=");
			if (sTask[1]) {
				return sTask[1];
			}
			return "";
		},
		


		onBackButtonPress: function () {
			this.onHandleCancelPress();
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			oRouter.navTo("toInvoiceList");
		},

		fnImageFmtr: function (value) {
			var imgSrc = value;
			return imgSrc;
		},

		onExit: function () {

			this.onHandleCancelPress();
			for (var sPropertyName in this._formFragments) {
				if (!this._formFragments.hasOwnProperty(sPropertyName) || this._formFragments[sPropertyName] == null) {
					return;
				}

				this._formFragments[sPropertyName].destroy();
				this._formFragments[sPropertyName] = null;
			}
		},

		onHandleEditPress: function () {

			this._toggleButtonsAndView(true);

			this.byId("btnSave").setVisible(true);
			this.byId("btnSave").setEnabled(true);
			this.byId("btnCancel").setVisible(true);
			this.byId("btnDelete").setEnabled(false);
			this.byId("btnCopy").setEnabled(false);
			this.byId("btnEdit").setEnabled(false);
			this.byId("btnSubmit").setEnabled(false);
			this.byId("btnApprove").setEnabled(false);
			this.byId("btnReject").setEnabled(false);

			// Edit Fragment - Get the PONumber and make poItemTab or nonpoItemtab visible
			// var poNumber = sap.ui.getCore().purchaseOrder;
			if (sap.ui.getCore().purchaseOrder !== "" || sap.ui.getCore().poNumDetailSceenFromWF !== "") {
				this.byId("nonpoItemTabEdit").setVisible(false);
				this.byId("poItemTabEdit").setVisible(true);

			} else {
				this.byId("nonpoItemTabEdit").setVisible(true);
				this.byId("poItemTabEdit").setVisible(false);
			}

		},

		onHandleCancelPress: function () {
			this._toggleButtonsAndView(false);
			// this.byId("btnSave").setVisible(false);
			// this.byId("btnSave").setEnabled(true);
			this.byId("btnCancel").setVisible(false);
			this.byId("btnDelete").setVisible(true);
			this.byId("btnCopy").setVisible(true);
			this.byId("btnEdit").setEnabled(true);

			// var btnException = this.byId("btnExceptions");
			// if (btnException.getText() === "0") {
			// 	this.byId("btnSubmit").setEnabled(true);
			// 	this.byId("btnApprove").setEnabled(true);
			// 	this.byId("btnReject").setEnabled(true);
			// }
			// // Disp Fragment - Get the PONumber and make poItemTab or nonpoItemtab visible
			// // var poNumber = sap.ui.getCore().purchaseOrder;
			// if (sap.ui.getCore().purchaseOrder!=="") {
			// 	this.byId("nonpoItemTabDisp").setVisible(false);
			// 	this.byId("poItemTabDisp").setVisible(true);

			// } else{
			// 	this.byId("nonpoItemTabDisp").setVisible(true);
			// 	this.byId("poItemTabDisp").setVisible(false);
			// }
		},

		onHandleSavePress: function () {
			this._toggleButtonsAndView(false);
			this._saveInvoice();
			// window.location.reload();

			var btnException = this.byId("btnExceptions");
			if (btnException.getText() === "0") {
				this.byId("btnSubmit").setEnabled(true);
				this.byId("btnApprove").setEnabled(true);
				this.byId("btnReject").setEnabled(true);
			}

			var statusIndicator = this.getView().byId("invoiceStatusIndicatorBox");
			var statusIndicatorText = statusIndicator.getItems()[0];
			var statusIndicatorPF = statusIndicator.getItems()[1];
			
			if(sap.ui.getCore().invoiceStatus==="Pending_Approval" || this.getCurrentUserRole() === APPROVER_ROLE)
			{
				this.byId("btnSave").setEnabled(false);
				this.byId("btnEdit").setEnabled(false);
				this.byId("btnSubmit").setEnabled(false);
			}
			else{
				statusIndicatorText.setText("In Progress");
				statusIndicatorText.setIcon("sap-icon://process");
				statusIndicatorText.setState(sap.ui.core.ValueState.Warning);
	
				var documentScanState = sap.ui.core.ValueState.Success;
				var inProcessState = sap.ui.core.ValueState.None;
				var invoicePostedStatus = sap.ui.core.ValueState.None;
	
				documentScanState = sap.ui.core.ValueState.Success;
				inProcessState = sap.ui.core.ValueState.Warning;
				invoicePostedStatus = sap.ui.core.ValueState.None;
	
				var statusIndContent = statusIndicatorPF.getContent();
				statusIndContent[0].setState(documentScanState);
				statusIndContent[1].setState(inProcessState);
				statusIndContent[2].setState(invoicePostedStatus);
			}
		},

		//function to remove null values
		filterNull: function (obj) {
			for (var key in obj) {
				if (obj[key] === null) {
					obj[key] = "";
				}
				// else if (Object.prototype.toString.call(obj[key]) === '[object Object]') {
				// 	filter(obj[key]);
				// }
			}
		},
		//save 
		_saveInvoice: function () {

			var currentViewController = this;

			var invoiceDetails = this.getView().getModel("invoiceDetails");
			var invoiceDetailsJSON = invoiceDetails.getData();

			//If the data has not changed after loading, do not call the service
			if (this.getCurrentUserRole() === APPROVER_ROLE && JSON.stringify(invoiceDetailsJSON) === _formData) {
				return false;
			}
			var invoiceItems = [];
			var counter = 1;

			invoiceDetails.getProperty("/items/results").forEach(function (invoiceDetailsItem) {
				var invoiceItem = {};
				invoiceItem.invoiceID = invoiceDetails.getProperty("/invoiceID");
				invoiceItem.invoiceItemIndex = counter++;
				invoiceItem.invoiceStatus = invoiceDetails.getProperty("/invoiceStatus") || "";
				invoiceItem.documentType = invoiceDetails.getProperty("/documentType") || "";
				invoiceItem.documentDate = invoiceDetails.getProperty("/documentDate") || "";
				invoiceItem.invoiceDate = invoiceDetails.getProperty("/invoiceDate") || "";
				invoiceItem.postingDate = invoiceDetails.getProperty("/postingDate") || "";
				invoiceItem.invoicingParty = invoiceDetails.getProperty("/invoicingParty") || "";
				invoiceItem.companyCode = invoiceDetails.getProperty("/companyCode") || "";
				invoiceItem.paymentCurrency = invoiceDetails.getProperty("/paymentCurrency") || "";
				invoiceItem.invoiceType = invoiceDetails.getProperty("/invoiceType") || "";
				invoiceItem.headerText = invoiceDetails.getProperty("/headerText") || "";
				invoiceItem.supplierNumber = invoiceDetails.getProperty("/supplierNumber") || "";
				invoiceItem.paymentMethod = invoiceDetails.getProperty("/paymentMethod") || "";
				invoiceItem.paymentBlock = invoiceDetails.getProperty("/paymentBlock") || "";
				invoiceItem.partnerBank = invoiceDetails.getProperty("/partnerBank") || "";
				invoiceItem.houseBank = invoiceDetails.getProperty("/houseBank") || "";
				invoiceItem.houseBankAccountID = invoiceDetails.getProperty("/houseBankAccountID") || "";
				invoiceItem.paymentMethodSupp = invoiceDetails.getProperty("/paymentMethodSupp") || "";
				invoiceItem.autoCalculateTaxIndicator = invoiceDetails.getProperty("/autoCalculateTaxIndicator") || "";
				invoiceItem.totalTaxAmount = invoiceDetails.getProperty("/totalTaxAmount") || "";
				invoiceItem.taxJurisdiction = invoiceDetails.getProperty("/taxJurisdiction") || "";
				invoiceItem.baselineDate = invoiceDetails.getProperty("/baselineDate") || "";
				invoiceItem.dueDate = invoiceDetails.getProperty("/dueDate") || "";
				invoiceItem.vatAmount = invoiceDetails.getProperty("/vatAmount") || "";
				invoiceItem.vatAmount1 = invoiceDetails.getProperty("/vatAmount1") || "";
				invoiceItem.vatAmount2 = invoiceDetails.getProperty("/vatAmount2") || "";
				invoiceItem.vatAmount3 = invoiceDetails.getProperty("/vatAmount3") || "";
				invoiceItem.vatAmount4 = invoiceDetails.getProperty("/vatAmount4") || "";
				invoiceItem.vatRate = invoiceDetails.getProperty("/vatRate") || "";
				invoiceItem.vatRate1 = invoiceDetails.getProperty("/vatRate1") || "";
				invoiceItem.vatRate2 = invoiceDetails.getProperty("/vatRate2") || "";
				invoiceItem.vatRate3 = invoiceDetails.getProperty("/vatRate3") || "";
				invoiceItem.vatRate4 = invoiceDetails.getProperty("/vatRate4") || "";
				invoiceItem.paymentTerms = invoiceDetails.getProperty("/paymentTerms") || "";
				invoiceItem.day1 = invoiceDetails.getProperty("/day1") || "";
				invoiceItem.day2 = invoiceDetails.getProperty("/day2") || "";
				invoiceItem.day3 = invoiceDetails.getProperty("/day3") || "";
				invoiceItem.discount1 = invoiceDetails.getProperty("/discount1") || "";
				invoiceItem.discount2 = invoiceDetails.getProperty("/discount2") || "";
				invoiceItem.exchangeRate = invoiceDetails.getProperty("/exchangeRate") || "";
				invoiceItem.withholdingTax = invoiceDetails.getProperty("/withholdingTax") || "";
				invoiceItem.unplannedDeliveryCost = invoiceDetails.getProperty("/unplannedDeliveryCost") || "";
				invoiceItem.instanceKey = invoiceDetails.getProperty("/instanceKey") || "";
				invoiceItem.bankAccount = invoiceDetails.getProperty("/bankAccount") || "";
				invoiceItem.bankName = invoiceDetails.getProperty("/bankName") || "";
				invoiceItem.bankNumber = invoiceDetails.getProperty("/bankNumber") || "";
				invoiceItem.bankPartnerType = invoiceDetails.getProperty("/bankPartnerType") || "";
				invoiceItem.vatID = invoiceDetails.getProperty("/vatID") || "";
				invoiceItem.vatID1 = invoiceDetails.getProperty("/vatID1") || "";
				invoiceItem.vatID2 = invoiceDetails.getProperty("/vatID2") || "";
				invoiceItem.vatID3 = invoiceDetails.getProperty("/vatID3") || "";
				invoiceItem.vatID4 = invoiceDetails.getProperty("/vatID4") || "";
				invoiceItem.requestorEmail = invoiceDetails.getProperty("/requestorEmail") || "";
				invoiceItem.invoiceFreightAmount = invoiceDetails.getProperty("/invoiceFreightAmount") || "";
				invoiceItem.invoiceHandlingCharges = invoiceDetails.getProperty("/invoiceHandlingCharges") || "";
				invoiceItem.alternatePayee = invoiceDetails.getProperty("/alternatePayee") || "";
				invoiceItem.documentItemInInvoice = invoiceDetails.getProperty("/documentItemInInvoice") || "";
				invoiceItem.purchaseOrder = invoiceDetails.getProperty("/purchaseOrder") || "";
				invoiceItem.itemPurchaseOrder = invoiceDetails.getProperty("/itemPurchaseOrder") || "";
				invoiceItem.uomPurchaseOrder = invoiceDetails.getProperty("/uomPurchaseOrder") || "";
				invoiceItem.amountDocumentCurrency = invoiceDetails.getProperty("/amountDocumentCurrency") || "";
				invoiceItem.deliveryNoteNumber = invoiceDetails.getProperty("/deliveryNoteNumber") || "";
				invoiceItem.materialNumber = invoiceDetails.getProperty("/materialNumber") || "";
				invoiceItem.taxCode = invoiceDetails.getProperty("/taxCode") || "";
				invoiceItem.accountAssigned = invoiceDetails.getProperty("/accountAssigned") || "";
				invoiceItem.directPostingGL = invoiceDetails.getProperty("/directPostingGL") || "";
				invoiceItem.directPostingMaterial = invoiceDetails.getProperty("/directPostingMaterial") || "";
				invoiceItem.lastUser = "";
				invoiceItem.currentUser = "";
				invoiceItem.lastUpdatedTS = invoiceDetails.getProperty("/lastUpdatedTS") || "";
				invoiceItem.lastRole = invoiceDetails.getProperty("/lastRole") || "";
				invoiceItem.invoiceCategory = invoiceDetails.getProperty("/invoiceCategory") || "";
				invoiceItem.shipToAddress1 = invoiceDetails.getProperty("/shipToAddress1") || "";
				invoiceItem.shipToAddress2 = invoiceDetails.getProperty("/shipToAddress2") || "";
				invoiceItem.billToCompany = invoiceDetails.getProperty("/billToCompany") || "";
				invoiceItem.billToName = invoiceDetails.getProperty("/billToName") || "";
				invoiceItem.billToPhone = invoiceDetails.getProperty("/billToPhone") || "";
				invoiceItem.billToAddress1 = invoiceDetails.getProperty("/billToAddress1") || "";
				invoiceItem.billToAddress2 = invoiceDetails.getProperty("/billToAddress2") || "";
				invoiceItem.billToCountry = invoiceDetails.getProperty("/billToCountry") || "";
				invoiceItem.billToVAT = invoiceDetails.getProperty("/billToVAT") || "";
				invoiceItem.billToEmail = invoiceDetails.getProperty("/billToEmail") || "";
				invoiceItem.remitName = invoiceDetails.getProperty("/remitName") || "";
				invoiceItem.remitToAddress1 = invoiceDetails.getProperty("/remitToAddress1") || "";
				invoiceItem.remitToAddress2 = invoiceDetails.getProperty("/remitToAddress2") || "";
				invoiceItem.remitToPin = invoiceDetails.getProperty("/remitToPin") || "";
				invoiceItem.remitToStreet = invoiceDetails.getProperty("/remitToStreet") || "";
				invoiceItem.remitToVAT = invoiceDetails.getProperty("/remitToVAT") || "";
				invoiceItem.remitToEmail = invoiceDetails.getProperty("/remitToEmail") || "";
				invoiceItem.remitToPhone = invoiceDetails.getProperty("/remitToPhone") || "";
				invoiceItem.supplierName = invoiceDetails.getProperty("/supplierName") || "";
				invoiceItem.supplierName2 = invoiceDetails.getProperty("/supplierName2") || "";
				invoiceItem.supplierPOBox = invoiceDetails.getProperty("/supplierPOBox") || "";
				invoiceItem.supplierPOBoxZip = invoiceDetails.getProperty("/supplierPOBoxZip") || "";
				invoiceItem.supplierStreet = invoiceDetails.getProperty("/supplierStreet") || "";
				invoiceItem.supplierState = invoiceDetails.getProperty("/supplierState") || "";
				invoiceItem.supplierZip = invoiceDetails.getProperty("/supplierZip") || "";
				invoiceItem.netAmount = invoiceDetails.getProperty("/netAmount") || "";
				invoiceItem.ibanNumber = invoiceDetails.getProperty("/ibanNumber") || "";
				invoiceItem.swiftCode = invoiceDetails.getProperty("/swiftCode") || "";
				invoiceItem.grossAmount = invoiceDetails.getProperty("/grossAmount") || "";
				invoiceItem.glAccount = invoiceDetails.getProperty("/glAccount") || "";
				invoiceItem.glDescription = invoiceDetails.getProperty("/glDescription") || "";
				invoiceItem.costCenter = invoiceDetails.getProperty("/costCenter") || "";
				invoiceItem.costCenterDescription = invoiceDetails.getProperty("/costCenterDescription") || "";
				invoiceItem.wbsElement = "";
				invoiceItem.wbsElementDescription = "";
				invoiceItem.internalOrder = invoiceDetails.getProperty("/internalOrder") || "";
				invoiceItem.internalOrderDescription = "";
				invoiceItem.assetID = invoiceDetails.getProperty("/assetID") || "";
				invoiceItem.assetDescription = invoiceDetails.getProperty("/assetDescription") || "";
				invoiceItem.invoiceFileName = invoiceDetails.getProperty("/invoiceFileName") || "";
				invoiceItem.postedInvoice = "";
				invoiceItem.invoiceGUID = invoiceDetails.getProperty("/invoiceGUID");

				if (!(invoiceItem.invoiceID === "")) {
					// Items
					invoiceItem.itemNumber = invoiceDetailsItem.itemNumber || "";
					invoiceItem.itemCode = invoiceDetailsItem.itemCode || "";
					// invoiceItem.itemCompanyCode = invoiceDetailsItem.itemCompanyCode;
					invoiceItem.itemDescription = invoiceDetailsItem.itemDescription || "";
					invoiceItem.itemQuantity = invoiceDetailsItem.itemQuantity || "";
					invoiceItem.unitPrice = invoiceDetailsItem.unitPrice || "";
					invoiceItem.itemUnit = invoiceDetailsItem.itemUnit || "";
					invoiceItem.itemQuantityShipped = invoiceDetailsItem.itemQuantityShipped || "";
					invoiceItem.itemTax = invoiceDetailsItem.itemTax || "";
					invoiceItem.itemTaxRate = invoiceDetailsItem.itemTaxRate || "";
					invoiceItem.totalAmount = invoiceDetailsItem.totalAmount || "";
					invoiceItem.pgiDate = invoiceDetailsItem.pgiDate || "";
				}

				invoiceItems.push(invoiceItem);
			});

			//function to remove null values

			this.filterNull(invoiceItems);

			var servicePayloadJSON = JSON.stringify({
				invoiceItems: invoiceItems
			});
 
			$.post({
				url: SAVE_INVOICE_SERVICE,
				contentType: 'application/json',
				async: false,
				data: servicePayloadJSON
			}).done(function (responseData, textStatus, xhr) {

				// Update the successfully derived fields in the UI and make them available on the details page
				_formData = JSON.stringify(invoiceDetailsJSON);
				currentViewController._updateModelAfterInvoiceSave(responseData.updatedInvoiceItems, invoiceDetails);
				// Load the exception messages in the error message pop over
				if (responseData.exceptions) {
					currentViewController._displayExceptions(responseData.exceptions,
						(responseData.exceptions && (responseData.exceptions.length > 0)));
					currentViewController.byId("btnSubmit").setEnabled(false);
					// sap.ui.getCore().lengthExcep = responseData.exceptions.length;
				} else {
					oMessagePopover.setModel(new JSONModel(""));

					var btnException = currentViewController.byId("btnExceptions");
					btnException.setText(0);
					// 	currentViewController._displayExceptions(((!responseData.exceptions) ),false);
					currentViewController.byId("btnSubmit").setEnabled(true);
				}

				MessageToast.show("Invoice saved");
				// currentViewController.byId("btnSubmit").setEnabled(true);

			}).fail(function (xhr, textStatus, error) {

				// Display an error message box with the error message
				MessageBox.error("Invoice Save Failed: " + error.toString());

			});

			//Send data to WF Obj
			var contextData = {};
			contextData = invoiceItems[0];
			sap.ui.getCore().invoiceDetailsWF = contextData; /*invoiceDetailsWF - To be used in WF call*/

		},

		_formFragments: {},

		_toggleButtonsAndView: function (bEdit) {

			// Set the right form type
			this._showFormFragment(bEdit ? "InvoiceDetailChange" : "InvoiceDetailDisplay");

		},

		_getFormFragment: function (sFragmentName) {

			// sap.ui.getCore().sFragmentName = sFragmentName;
			var oFormFragment = this._formFragments[sFragmentName];

			if (oFormFragment) {
				return oFormFragment;
			}

			oFormFragment = sap.ui.xmlfragment(this.getView().getId(), "com.deloitte.scp.app.InvoiceProcessornew.view." + sFragmentName);

			this._formFragments[sFragmentName] = oFormFragment;
			return this._formFragments[sFragmentName];
		},

		_showFormFragment: function (sFragmentName) {
			//setting the id of the Dynamic Page created in the view//
			var oPage = this.byId("dpInvoicedetailId");
			oPage.setContent(this._getFormFragment(sFragmentName));
		},

		_loadExceptions: function (oInvoiceModel, invoiceGUID) {

			var currentViewController = this;

			var invoiceServiceURL = oInvoiceModel.sServiceUrl;
			var queryStatus = new $.Deferred();

			$.get(invoiceServiceURL + "/InvoiceExceptions?$filter=invoiceGUID eq '" + invoiceGUID + "'&$format=json")
				.done(function (
					responseData) {

					var exceptionsJSON = JSON.parse(JSON.stringify(responseData));
					if (exceptionsJSON.d.results && exceptionsJSON.d.results.length) {
						_hasExceptions = true;
					} else {
						_hasExceptions = false;
					}
					currentViewController._displayExceptions(exceptionsJSON.d.results);
					queryStatus.resolve();

				})
				.fail(function (jqXHR, textStatus, error) {
					MessageBox.error("Error" + error.toString());
					queryStatus.reject();
				});
			return queryStatus.promise();

		},

		_displayExceptions: function (exceptionsJSON, showExceptions) {

			var exceptionData = exceptionsJSON.map(function (e) {
				return {
					type: "Error",
					title: "Exception",
					description: e.exceptionMessage
				};
			});
			oMessagePopover.setModel(new JSONModel(exceptionData));
			//Disable submit button if there are exceptions
			if (exceptionData.length !== 0) {
				this.byId("btnSubmit").setEnabled(!exceptionData.length);
			}
			if (sap.ui.getCore().invoiceDetailsWF.invoiceStatus !== "In_Progress") {
				this.byId("btnSubmit").setEnabled(false);
			}

			var btnException = this.byId("btnExceptions");
			btnException.setText(exceptionData.length || 0);

			if (showExceptions) {
				btnException.firePress();
			}
		},

		_updateModelAfterInvoiceSave: function (updatedItems, oInvoiceModel) {
			if (updatedItems && updatedItems.length) {
				updatedItems.forEach(function (item) {
					var index = item.invoiceItemIndex;
					if (!index) {
						return;
					}
					var invoiceItem = oInvoiceModel.getProperty("/items/results")[index - 1];
					Object.keys(item).forEach(function (key) {
						if (typeof oInvoiceModel.getProperty("/" + key) !== "undefined" && oInvoiceModel.getProperty("/" + key) !== item[key]) {
							oInvoiceModel.setProperty("/" + key, item[key]);
						}
						if (typeof invoiceItem[key] !== "undefined" && invoiceItem[key] !== item[key]) {
							oInvoiceModel.setProperty("/items/results/" + (index - 1) + "/" + key, item[key]);
						}
					});

				});
			}
		},

		onMessagePopoverPress: function (oEvent) {
			oMessagePopover.toggle(oEvent.getSource());
		},

		// WorkFlow Ftech Token and call instance methods
		onSubmitPress: function () {

			var token = this._fetchToken(); //Fetch Token for WF from bpmruntime
			if(token){
			this._startInstance(token); //Start WF Instance - My Inbox
			this._setPendingApprvalStatusOnSubmit(); //Post the invoice status as "Pending_Approval"
			
			
			var msg = "Invoice is submitted for the approval.";
			MessageToast.show(msg);
			this.byId("btnSubmit").setEnabled(false);

			// statusIndContent[2].setState(invoicePostedStatus);
			}
		},

		_displayPostingErrors: function (postingErrorsJSON) {
			sap.m.MessageBox.error("Error: " + postingErrorsJSON.postingErrors[0].errorMessage);

			/*	var oPostingErrorTemplate = new sap.m.MessageItem({
					type: '{type}',
					title: '{title}',
					description: '{description}',
					subtitle: '{subtitle}',
					counter: '{counter}',
					markupDescription: '{markupDescription}'
				});

				var postingErrors = postingErrorsJSON.map(function (postingError) {
					return {
						Error: postingError.errorMessage
					};
				});
				// sap.m.MessageBox.error("Error: "+ postingErrorsJSON.postingErrors[0].errorMessage);
				// sap.m.MessageBox.error(JSON.stringify(postingErrorsJSON[0].errorMessage));
		
				var oPostingErrorsMessageView = new MessageView({
					showDetailsPageHeader: false,
					itemSelect: function () {
						oBackButton.setVisible(true);
					},
					items: {
						path: "/",
						template: oMessageTemplate
					}
				});

				var oBackButton = new sap.m.Button({
					icon: sap.ui.core.IconPool.getIconURI("nav-back"),
					visible: false,
					press: function () {
						oPostingErrorsMessageView.navigateBack();
						this.setVisible(false);
					}
				});

				oPostingErrorsMessageView.setModel(new JSONModel(postingErrors));

				var oPostingErrorsDialog = new sap.m.Dialog({
					resizable: true,
					content: oPostingErrorsMessageView,
					state: 'Error',

					beginButton: new sap.m.Button({
						press: function () {
							this.getParent().close();
						},
						text: "Close"
					}),

					customHeader: new sap.m.Bar({
						contentMiddle: [
							new sap.m.Text({
								text: "Posting Errors"
							})
						],
						contentLeft: [oBackButton]
					}),
					contentHeight: "300px",
					contentWidth: "500px",
					verticalScrolling: false
				});

				oPostingErrorsDialog.open();*/
		},

		onPageLoadForWorkflow: function () {

			this.byId("btnApprove").setVisible(true);
			this.byId("btnReject").setVisible(true);
			this.byId("btnApprove").setEnabled(true);
			this.byId("btnReject").setEnabled(true);
			this.byId("btnEdit").setEnabled(true);
			this.byId("btnSave").setVisible(true);
			this.byId("btnSubmit").setVisible(false);
			this.byId("btnDelete").setVisible(false);
			this.byId("btnCopy").setVisible(false);
			this.byId("btnBackTop").setEnabled(false);
			this.byId("btnBack").setEnabled(false);

			if (_hasExceptions) {
				this.byId("btnApprove").setEnabled(false);
			}

			// Get the PONumber and make poItemTab or nonpoItemtab visible depending on selection of the invoice from the list - Initial load of Detail view
			// var poNumber = sap.ui.getCore().purchaseOrder;
			if (sap.ui.getCore().poNumDetailSceenFromWF !== "") {
				this.byId("nonpoItemTab").setVisible(false);
				this.byId("poItemTab").setVisible(true);

			} else {
				this.byId("nonpoItemTab").setVisible(true);
				this.byId("poItemTab").setVisible(false);
			}

			// // Disp Fragment - Get the PONumber and make poItemTab or nonpoItemtab visible
			// var poNumber = sap.ui.getCore().purchaseOrder;
			if (this.byId("nonpoItemTabDisp")) {
				if (sap.ui.getCore().purchaseOrder === "") {
					this.byId("nonpoItemTabDisp").setVisible(true);
					this.byId("poItemTabDisp").setVisible(false);

				} else {
					this.byId("nonpoItemTabDisp").setVisible(false);
					this.byId("poItemTabDisp").setVisible(true);
				}
			}
			if (this.byId("poItemTabDisp")) {
				if (sap.ui.getCore().purchaseOrder === "") {
					this.byId("nonpoItemTabDisp").setVisible(true);
					this.byId("poItemTabDisp").setVisible(false);

				} else {
					this.byId("nonpoItemTabDisp").setVisible(false);
					this.byId("poItemTabDisp").setVisible(true);
				}

			}

		},

		// Post the Invoice to SAP System
		onApprovePress: function (oEvent) {
			// var token = this._fetchToken();
			// this._startInstance(token);
			// var msg = "Invoice is submitted for the approval.";
			// MessageToast.show(msg);

			// var odata_service_url = "/HDB_SCP/com/deloitte/apps/invoiceprocessor/services/postInvoice/postInvoice.xsjs";

			var invoiceDetails = new JSONModel();
			invoiceDetails = this.getView().getModel("invoiceDetails");
			// var context = JSON.parse(invoiceDetails);
			var invoiceItems = {};
			// var invoiceItemsNew = {};
			// var Items = [];
			var JSONString;

			// invoiceItems.invoiceID = invoiceDetails.getProperty("/invoiceID");
			invoiceItems.invoiceGUID = invoiceDetails.getProperty("/invoiceGUID");
			JSONString = JSON.stringify(invoiceItems);

			var currentViewController = this;
			// var servicePayloadJSON = JSON.stringify({
			// 	invoiceGUID: sap.ui.getCore().invoiceGUID
			// });

			$.ajax({
				url: POST_INVOICE_SERVICE,
				method: "POST",
				contentType: 'application/json',
				dataType: 'json',
				// async : false,
				// data: servicePayloadJSON,
				data: JSONString,
				headers: {
					"Accept": "application/json",
					"Access-Control-Allow-Origin": "*"
				},
				success: function (responseData, textStatus, jqXHR) {
					// sap.m.MessageToast.show('Data Created Successfully');
					// var jsonUpdatedData = data;
					if (responseData.postingErrors) {
						// currentViewController._displayPostingErrors(responseData.postingErrors[0]);
						sap.m.MessageBox.error("Error: " + responseData.postingErrors[0].errorMessage);

					}
					if (responseData.postedInvoice) {
						sap.m.MessageBox.information(
							"Invoice: " + responseData.postedInvoice + " successfully posted"
						);
						
						// Refresh the list of tasks on WF - Remove the WF task from list
						var sTaskId = sap.ui.getCore.sTask;
						currentViewController._completeApproval(sTaskId, true);
						
						// Make all the buttons disabled after you approve/post to SAP.
						currentViewController.byId("btnApprove").setEnabled(false);
						currentViewController.byId("btnReject").setEnabled(false);
						currentViewController.byId("btnEdit").setEnabled(false);
						currentViewController.byId("btnSave").setEnabled(false);
						currentViewController.byId("btnCancel").setEnabled(false);
						// currentViewController.byId("btnBackTop").setEnabled(false);
						// currentViewController.byId("btnBack").setEnabled(false);
					}
					// Make back buttons disabled on "role"= approver screen while posting to SAP.
					currentViewController.byId("btnBackTop").setEnabled(false);
					currentViewController.byId("btnBack").setEnabled(false);

					// Refresh the list of tasks on WF - Remove the WF task from list
					// var sTaskId = currentViewController.getCurrentWFTask();
					// var sTaskId = sap.ui.getCore.sTask;
					// currentViewController._completeApproval(sTaskId, true);

				},
				error: function (jqXHR, textStatus, errorThrown) {
					sap.m.MessageToast.show("Invoice Posting Failed: " + errorThrown.toString());
				}
			});

		},

		// Loads from WF Inbox Task - Reject with comments
		onRejPress: function (oEvent) {
		
			var currentViewController = this;
			var sText;  
			var dialog = new sap.m.Dialog({
				title: 'Reject',
				type: 'Message',
				content: [
					new sap.m.Label({ text: 'Are you sure you want to reject the invoice?', labelFor: 'rejectDialogTextarea'}),
					new sap.m.TextArea('rejectDialogTextarea', {
						width: '100%',
						placeholder: 'Add note (optional)'
					})
				],
				beginButton: new sap.m.Button({
					text: 'Reject',
					press: function () {
						sText = sap.ui.getCore().byId('rejectDialogTextarea').getValue();
						// sap.m.MessageToast.show('Note is: ' + sText);
						currentViewController._postComments(sText);
						dialog.close();
					}
				}),
				endButton: new sap.m.Button({
					text: 'Cancel',
					press: function () {
						dialog.close();
					}
				}),
				afterClose: function() {
					dialog.destroy();
				}
				});

			dialog.open();	
		},
		
		// POST call to save reject comments 
		_postComments: function (sText) {
				
				var currentViewController = this;
				var serviceRejPayloadJSON = JSON.stringify({
					invoiceGUID: sap.ui.getCore.iGUIDFromWFTask,
					responseType: "Rejected",
					comments:sText
				});
			
				$.ajax({
					type: 'POST', //GET or POST or PUT or DELETE verb 
					async : false,
					data: serviceRejPayloadJSON, //Data sent to server
					url: CAPTURE_REJECTCOMMENT_SERVICE, // Location of the service  
					contentType: 'application/json', 
					dataType: 'json', //Expected data format from server
					
					success: function(responseData, textStatus, xhr){ //On Successfull service call 
						if (textStatus === "success") {
						sap.m.MessageBox.information("The invoice got rejected");
						}
						//Complete the task with status as Reject / Remove from My Inbox with a refresh
						var sTaskId = sap.ui.getCore.sTask;
						currentViewController._completeApproval(sTaskId, true);
						// Make all the buttons disabled after someone Reject the invoice.
						currentViewController.byId("btnApprove").setEnabled(false);
						currentViewController.byId("btnReject").setEnabled(false);
						currentViewController.byId("btnEdit").setEnabled(false);
						currentViewController.byId("btnSave").setEnabled(false);
						currentViewController.byId("btnCancel").setEnabled(false);
						
						currentViewController.byId("btnBackTop").setEnabled(false);
						currentViewController.byId("btnBack").setEnabled(false);
					},
					error: function (xhr) { 
						// console.log(xhr.responseText); 
						MessageBox.error(xhr.responseText);
					} // When Service call fails
				});
		},

		_fetchToken: function () {
			var token;
			$.ajax({
				url: "/bpmworkflowruntime/rest/v1/xsrf-token",
				method: "GET",
				async: false,
				headers: {
					"X-CSRF-Token": "Fetch"
				},
				success: function (result, xhr, data) {
					token = data.getResponseHeader("X-CSRF-Token");
				}
			});
			return token;
		},

		_startInstance: function (token) {
			var model = this.getView().getModel();
			var obj = {};
			obj = sap.ui.getCore().invoiceDetailsWF;
			$.ajax({
				url: "/bpmworkflowruntime/rest/v1/workflow-instances",
				method: "POST",
				async: false,
				contentType: "application/json",
				headers: {
					"X-CSRF-Token": token
				},
				data: JSON.stringify({
					definitionId: "approver_workflow",
					context: sap.ui.getCore().invoiceDetailsWF
				}),
				success: function (result, xhr, data) {
					model.setProperty("/result", JSON.stringify(result, null, 4));
				}
			});
		},

		_completeApproval: function (sTaskId, bApprovalStatus) {
			var currentViewController = this;
			var sWorkflowToken = this._fetchToken();
			var fnRemoveFromTaskList = function () {
				// remove task from the approver 1 list
				return new Promise(function (resolve, reject) {
					$.ajax({
						url: "/bpmworkflowruntime/rest/v1/task-instances/" + sTaskId,
						method: "PATCH",
						contentType: "application/json",
						async: false,
						data: "{\"status\": \"COMPLETED\", \"context\": {\"approved\":\"" +
							bApprovalStatus + "\"}}",
						headers: {
							"X-CSRF-Token": sWorkflowToken
						},
						success: function () {
							resolve();
							// currentViewController.getComponentData().startupParameters.inboxAPI.updateTask("NA", sTaskId);
						}
					});
				});
			};
			
			// My Inbox - Tasklist Auto Refresh 
			var fnRefreshTask = function () {
				// this.getComponentData().startupParameters.inboxAPI.updateTask("NA", sTaskId);
				sap.m.MessageToast.show("WF Task Completed");
			}.bind(this);

			fnRemoveFromTaskList().then(fnRefreshTask());
		},
		
		// POST method for Invoice Status- "Pending Approval" after Submission of Invoice for Approval 
		_setPendingApprvalStatusOnSubmit: function () {
				var currentViewController = this;
				var servicePayloadJSON_PendingApproval = JSON.stringify({
					invoiceGUID: sap.ui.getCore().invoiceGUIDFromList
				});
			
				$.ajax({
					type: 'POST', //GET or POST or PUT or DELETE verb 
					async : false,
					data: servicePayloadJSON_PendingApproval, //Data sent to server
					url: POST_PENDING_APPROVAL_STATUS_onSubmit, // Location of the service  
					contentType: 'application/json', 
					dataType: 'json', //Expected data format from server
					
					success: function(responseData, textStatus, xhr){ //On Successfull service call 
						if (textStatus === "success") {
						
						// Make all the buttons disabled after submit the invoice for Approval.
						currentViewController.byId("btnEdit").setEnabled(false);
						currentViewController.byId("btnSave").setEnabled(false);
						currentViewController.byId("btnCancel").setEnabled(false);
						
						// return "success";
						}
					
					},
					error: function (xhr) { 
						// console.log(xhr.responseText); 
						MessageBox.error(xhr.responseText);
					} // When Service call fails
				});
				}

	});

});