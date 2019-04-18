sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"com/deloitte/scp/app/InvoiceProcessornew/model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("com.deloitte.scp.app.InvoiceProcessornew.Component", {

		metadata: {
			manifest: "json",
			 dependencies : {
  libs : ["sap.m", "sap.ui.layout", "sap.suite.ui.commons,sap.ui.vbm,sap.viz"]
  }
		},
		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		}
	});
});