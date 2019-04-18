function initModel() {
	var sUrl = "/HDB_SCP/com/deloitte/apps/invoiceprocessor/InvoiceServices.xsodata/";
	var oModel = new sap.ui.model.odata.ODataModel(sUrl, true);
	sap.ui.getCore().setModel(oModel);
}