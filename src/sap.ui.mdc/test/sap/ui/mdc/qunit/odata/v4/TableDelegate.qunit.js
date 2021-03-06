/* global QUnit, sinon */
sap.ui.define([
	"sap/ui/mdc/Table",
	"../../QUnitUtils",
	"sap/ui/core/UIComponent",
	"sap/ui/core/ComponentContainer",
	"../../../delegates/odata/v4/TableDelegate",
	"sap/ui/fl/write/api/ControlPersonalizationWriteAPI",
	"sap/ui/core/Core"
], function(Table,
	MDCQUnitUtils,
	UIComponent,
	ComponentContainer,
	TestDelegate,
	ControlPersonalizationWriteAPI,
	Core) {
	'use strict';

	sap.ui.getCore().loadLibrary("sap.ui.fl");
	var UIComp = UIComponent.extend("test", {
		metadata: {
			manifest: {
				"sap.app": {
					"id": "",
					"type": "application"
				}
			}
		},
		createContent: function() {
			var oView = sap.ui.view({
				async: false,
				type: "XML",
				id: this.createId("view"),
				viewContent: '<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns="sap.ui.mdc" xmlns:mdcTable="sap.ui.mdc.table">' +
				'<Table p13nMode="Group,Aggregate" id="myTable" delegate=\'\{ name : "sap/ui/mdc/odata/v4/TableDelegate", payload : \{ "collectionName" : "ProductList" \} \}\'>' +
				'<columns><mdcTable:Column id="myTable--column0" header="column 0" dataProperty="Name">' +
				'<m:Text text="{Name}" id="myTable--text0" /></mdcTable:Column>' +
				'<mdcTable:Column id="myTable--column1" header="column 1" dataProperty="Country">' +
				'<m:Text text="{Country}" id="myTable--text1" /></mdcTable:Column>' +
				'<mdcTable:Column id="myTable--column2" header="column 2" dataProperty="name_country"> ' +
				'<m:Text text="{Name}" id="myTable--text2" /></mdcTable:Column></columns> ' +
				'</Table></mvc:View>'
			});

			return oView;
		}
	});

	QUnit.module("Basic functionality with JsControlTreeModifier", {
		beforeEach: function() {
			this.createTestObjects();
			return this.oTable.getEngine().getModificationHandler().waitForChanges({
				element: this.oTable
			});
		},
		afterEach: function() {
			this.destroyTestObjects();
		},
		createTestObjects: function() {
			this.oUiComponent = new UIComp("comp");

			// Place component in container and display
			this.oUiComponentContainer = new ComponentContainer({
				component: this.oUiComponent,
				async: false
			});
			this.oUiComponentContainer.placeAt("qunit-fixture");
			sap.ui.getCore().applyChanges();

			this.oView = this.oUiComponent.getRootControl();
			this.oTable = this.oView.byId('myTable');

			ControlPersonalizationWriteAPI.restore({
				selector: this.oTable
			});

			this.aPropertyInfo = [
				{
					name: "Name",
					label: "Name",
					path: "Name",
					groupable: true
				},
				{
					name: "Country",
					label: "Country",
					path: "Country",
					groupable: true
				},
				{
					name: "name_country",
					label: "Complex Title & Description",
					propertyInfos: ["Name", "Country"]
				}
			];
			MDCQUnitUtils.stubPropertyInfos(this.oTable , this.aPropertyInfo);
			MDCQUnitUtils.stubPropertyExtension(this.oTable , {
				Name: {
					defaultAggregate: {}
				},
				Country: {
					defaultAggregate: {}
				}
			});
		},
		destroyTestObjects: function() {
			MDCQUnitUtils.restorePropertyInfos(this.oTable);
			MDCQUnitUtils.restorePropertyExtension(this.oTable);
			this.oUiComponentContainer.destroy();
		}
	});

	QUnit.test("Allowed analytics in the columns", function(assert) {
		var fColumnPressSpy = sinon.spy(this.oTable, "_onColumnPress");
		var oResourceBundle = sap.ui.getCore().getLibraryResourceBundle("sap.ui.mdc");
		var oTable = this.oTable;

		return oTable._fullyInitialized().then(function() {
			var oFirstInnerColumn = oTable._oTable.getColumns()[0];

			oTable._oTable.fireEvent("columnSelect", {
				column: oFirstInnerColumn
			});
			assert.ok(fColumnPressSpy.calledOnce, "First Column pressed");

			return oTable._fullyInitialized();
		}).then(function() {
			var oThirdInnerColumn = oTable._oTable.getColumns()[2];

			assert.strictEqual(oTable._oPopover.getItems()[0].getLabel(), oResourceBundle.getText("table.SETTINGS_GROUP"),
				"The first column has group menu item");
			assert.strictEqual(oTable._oPopover.getItems()[1].getLabel(), oResourceBundle.getText("table.SETTINGS_AGGREGATE"),
				"The first column has aggregate menu item");

			oTable._oTable.fireEvent("columnSelect", {
				column: oThirdInnerColumn
			});
			return oTable._fullyInitialized();
		}).then(function() {
			assert.strictEqual(fColumnPressSpy.callCount, 2, "Third Column pressed");
			assert.strictEqual(oTable._oPopover.getItems()[0].getItems().length,2, "The last column has complex property with list of two items");
		});
	});

	QUnit.test("Grouping enabled on column press", function(assert) {
		var oTable = this.oTable;
		var done = assert.async();
		var fColumnPressSpy = sinon.spy(oTable, "_onColumnPress");

		 oTable._fullyInitialized().then(function() {
			var oInnerColumn = oTable._oTable.getColumns()[0];
			oTable._oTable.fireEvent("columnSelect", {
				column: oInnerColumn
			});
			assert.ok(fColumnPressSpy.calledOnce, "First column pressed");
			fColumnPressSpy.restore();

			setTimeout(function(){
				var oPlugin = oTable._oTable.getDependents()[0];
				var fSetAggregationSpy = sinon.spy(oPlugin, "setAggregationInfo");
				var oDelegate = oTable.getControlDelegate();
				var fnRebindTable = oDelegate.rebindTable;

				oDelegate.rebindTable = function () {
					fnRebindTable.apply(this, arguments);
					assert.ok(fSetAggregationSpy.calledOnceWithExactly({
						visible: oDelegate._getVisibleProperties(oTable),
						groupLevels: ["Name"],
						grandTotal: [],
						subtotals: []
					}), "Plugin#setAggregationInfo call");
					fSetAggregationSpy.restore();
					oDelegate.rebindTable = fnRebindTable;
					done();
				};
				oTable._oPopover.getAggregation("_popover").getContent()[0].getContent()[0].firePress();
			},0);

			//});
		});
	});

	QUnit.test("Aggregation enabled on column press", function(assert) {
		var oTable = this.oTable;
		var fColumnPressSpy = sinon.spy(oTable, "_onColumnPress");
		var done = assert.async();

		 oTable._fullyInitialized().then(function() {
			var oInnerSecondColumn = oTable._oTable.getColumns()[1];
			oTable._oTable.fireEvent("columnSelect", {
				column: oInnerSecondColumn
			});

			assert.ok(fColumnPressSpy.calledOnce, "First Column pressed");
			fColumnPressSpy.restore();

			oTable._fullyInitialized().then(function() {
				var oDelegate = oTable.getControlDelegate();
				var oPlugin = oTable._oTable.getDependents()[0];
				var fSetAggregationSpy = sinon.spy(oPlugin, "setAggregationInfo");
				var fnRebindTable = oDelegate.rebindTable;

				oDelegate.rebindTable = function () {
					fnRebindTable.apply(this, arguments);
					assert.ok(fSetAggregationSpy.calledOnceWithExactly({
						visible: oDelegate._getVisibleProperties(oTable),
						groupLevels: [],
						grandTotal: ["Country"],
						subtotals: ["Country"]
					}), "Plugin#setAggregationInfo call");
					fSetAggregationSpy.restore();
					oDelegate.rebindTable = fnRebindTable;
					done();
				};
				oTable._oPopover.getAggregation("_popover").getContent()[0].getContent()[1].firePress();
			});
		});
	});

	QUnit.test("Grouping and Aggregation on two columns", function(assert) {
		var oTable = this.oTable;
		var fColumnPressSpy = sinon.spy(oTable, "_onColumnPress");
		var done = assert.async();

		oTable._fullyInitialized().then(function() {
			var oInnerColumn = oTable._oTable.getColumns()[0];
			oTable._oTable.fireEvent("columnSelect", {
				column: oInnerColumn
			});
			assert.ok(fColumnPressSpy.calledOnce, "First Column pressed");

			oTable._fullyInitialized().then(function() {
				var oDelegate = oTable.getControlDelegate();
				var oPlugin = oTable._oTable.getDependents()[0];
				var fSetAggregationSpy = sinon.spy(oPlugin, "setAggregationInfo");
				var fnRebindTable = oDelegate.rebindTable;
				var oInnerSecondColumn = oTable._oTable.getColumns()[1];

				oDelegate.rebindTable = function () {
					fnRebindTable.apply(this, arguments);
					assert.ok(fSetAggregationSpy.calledOnceWithExactly({
						visible: oDelegate._getVisibleProperties(oTable),
						groupLevels: ["Name"],
						grandTotal: [],
						subtotals: []
					}), "Plugin#setAggregationInfo call");

					fColumnPressSpy.restore();
					fSetAggregationSpy.restore();
					oDelegate.rebindTable = fnRebindTable;
					oTable._oTable.fireEvent("columnSelect", {
						column: oInnerSecondColumn
					});

					oTable._fullyInitialized().then(function() {
						var oDelegate = oTable.getControlDelegate();
						var oPlugin = oTable._oTable.getDependents()[0];
						var fSetAggregationSpy = sinon.spy(oPlugin, "setAggregationInfo");
						var fnRebindTable = oDelegate.rebindTable;

						oDelegate.rebindTable = function () {
							fnRebindTable.apply(this, arguments);
							assert.ok(fSetAggregationSpy.calledOnceWithExactly({
								visible: oDelegate._getVisibleProperties(oTable),
								groupLevels: ["Name"],
								grandTotal: ["Country"],
								subtotals: ["Country"]
							}), "Plugin#setAggregationInfo call");

							fColumnPressSpy.restore();
							fSetAggregationSpy.restore();
							oDelegate.rebindTable = fnRebindTable;
							done();
						};
						oTable._oPopover.getAggregation("_popover").getContent()[0].getContent()[1].firePress();
					});
				};
				oTable._oPopover.getAggregation("_popover").getContent()[0].getContent()[0].firePress();
			});
		});
	});

	QUnit.test("Grouping and forced aggregation", function(assert) {
		var oTable = this.oTable;
		var fColumnPressSpy = sinon.spy(oTable, "_onColumnPress");
		var done = assert.async();

		oTable._fullyInitialized().then(function() {
			var oInnerColumn = oTable._oTable.getColumns()[0];

			oTable._oTable.fireEvent("columnSelect", {
				column: oInnerColumn
			});
			assert.ok(fColumnPressSpy.calledOnce, "First Column pressed");

			oTable._fullyInitialized().then(function() {
				var oDelegate = oTable.getControlDelegate();
				var oPlugin = oTable._oTable.getDependents()[0];
				var fSetAggregationSpy = sinon.spy(oPlugin, "setAggregationInfo");
				var fnRebindTable = oDelegate.rebindTable;

				oDelegate.rebindTable = function () {
					fnRebindTable.apply(this, arguments);
					assert.ok(fSetAggregationSpy.calledOnceWithExactly({
						visible: oDelegate._getVisibleProperties(oTable),
						groupLevels: ["Name"],
						grandTotal: [],
						subtotals: []
					}), "Plugin#setAggregationInfo call");

					fColumnPressSpy.restore();
					fSetAggregationSpy.restore();
					oDelegate.rebindTable = fnRebindTable;

					oDelegate.rebindTable = function () {
						fnRebindTable.apply(this, arguments);
						assert.ok(fSetAggregationSpy.calledOnceWithExactly({
							visible: oDelegate._getVisibleProperties(oTable),
							groupLevels: [],
							grandTotal: ["Name"],
							subtotals: ["Name"]
						}), "Plugin#setAggregationInfo call");
						fSetAggregationSpy.restore();
						oDelegate.rebindTable = fnRebindTable;
						fSetAggregationSpy.reset();
						done();
					};
					sinon.stub(sap.m.MessageBox, "warning");
					oTable._oPopover.getAggregation("_popover").getContent()[0].getContent()[1].firePress();
					oDelegate._forceAnalytics("Aggregate", oTable, "Name");
					fSetAggregationSpy = sinon.spy(oPlugin, "setAggregationInfo");
				};
				oTable._oPopover.getAggregation("_popover").getContent()[0].getContent()[0].firePress();
			});
		});
	});

	// This QUnit test is temporary and should be removed once the Excel Export has been re-enabled
	QUnit.test("Disable Excel Export", function(assert) {
		var oTable = this.oTable;

		return oTable._fullyInitialized().then(function() {
			assert.notOk(oTable.getEnableExport(), "enableExport=false");
			assert.equal(oTable._oExportButton, undefined, "Export button is not defined");
			oTable.setEnableExport(true);
			Core.applyChanges();
			assert.notOk(oTable.getEnableExport(), "enableExport=false also after trying to set it to true");
		});
	});
});
