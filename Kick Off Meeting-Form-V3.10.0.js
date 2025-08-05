///
/// Add features allow multiple tenant if in customer doctype is multiple tenant allowed
/// 3.7.2: Add feature to auto fill tower owner based on Catalog
/// 3.7.3: Fix bugs site owner on field site_id_ref and site_id_target
/// site_id_ref check to field check_site_owner (Link to tower owner)
/// site_id_target check to field check_site_on (Mitratel or Non Mitratel)
/// 25/11: Adjust to add button to update status app form
/// 3.10.0: Add Ladder Type and Ladder fields to Kick Off Meeting form

/// 8 May 2025 ticket SDP #4045 bugs reseller relocation (wajdi, hamid)

const column_field_map = {
    addChild_additional_services_list: {
        tower_id: 'Tenant ID Oneflux',
        device_object: {
            height: 'Height',
            device: 'Antenna Type'
        }
    }
};

const new_remove_map = {
    device: 'Antenna Type',
    height: 'Height',
    azimuth: 'Azimuth',
    brand: 'Manufacture',
    model: 'Model',
    length: 'Length (m)',
    width: 'Width (m)',
    depth: 'Depth (m)',
    weight: 'Weight (kg)',
    diameter: 'Diameter (m)',
    tower_foot_side: 'Foot Side',
    sow: 'SOW',
    quantity: 'Quantity',
    item_attribute: 'Attribute',
    attribute_value: 'Attribute Value',
    device_id: 'Remove Device ID'
};

function groupByIdentifier(data) {
    let result = [];
    var array = data,
        grouped = Array.from(
            array
                .reduce(
                    (m, o) => m.set(o['Site ID Tenant'], (m.get(o['Site ID Tenant']) || []).concat(o)),
                    new Map()
                )
                .values()
        );

    grouped.forEach((data) => {
        let tenantId = data[0]['Site ID Tenant'];
        let restOfData = data;
        let obj = {};
        obj[tenantId] = restOfData;
        obj['notes'] = data[0]['Notes'];
        result.push(obj);
    });
    return result;
}

function arrayGroup(data, key_identifier) {
    var array = data,
        grouped = Array.from(
            array
                .reduce(
                    (m, o) => m.set(o[key_identifier], (m.get(o[key_identifier]) || []).concat(o)),
                    new Map()
                )
                .values()
        );

    return grouped;
}

function groupByNew(data) {
    let result = [];
    let grouped = arrayGroup(data, 'Site ID Tenant');
    grouped.forEach((data) => {
        let tenantId = data[0]['Site ID Tenant'];
        console.log(tenantId);
        let notes = data[0]['Notes'];
        let restOfData = data.map((d) => {
            let { 'Site ID Tenant': removed, ...otherProperties } = d;
            return otherProperties;
        });
        let new_device = restOfData.filter((item) => item['Activity Benchmark'] === 'New');
        let remove_device = restOfData.filter((item) => item['Activity Benchmark'] === 'Remove');

        let obj = {};
        let device = {};
        let new_af_item = [];
        let remove_af_item = [];

        new_device.forEach((item) => {
            let new_item = {};
            for (const [key, value] of Object.entries(new_remove_map)) {
                new_item[key] = item[value];
            }
            new_af_item.push(new_item);
        });
        remove_device.forEach((item) => {
            let new_item = {};
            for (const [key, value] of Object.entries(new_remove_map)) {
                new_item[key] = item[value];
            }
            remove_af_item.push(new_item);
        });
        device['new_af_item'] = new_af_item;
        device['remove_af_item'] = remove_af_item;
        obj['site_id_tenant'] = tenantId;
        obj['notes'] = notes;
        obj['device_object'] = device;
        result.push(obj);
    });
    return result;
}

async function getFetchValue(fetch_dict, grid_fields, fieldname, value_selected, resp = {}) {
    for (const [key, value] of Object.entries(fetch_dict[fieldname])) {
        const df = grid_fields[fieldname];
        doctype = df.options;
        const value_fetch = await getValue(doctype, value_selected, value);
        // console.log(fieldname, df,value_selected, value_fetch)
        resp[key] = value_fetch;
        if (fetch_dict.hasOwnProperty(key)) {
            getFetchValue(fetch_dict, grid_fields, key, value_fetch, resp);
        }
    }
    return resp;
}

async function getValue(doctype, docname, field) {
    let value = await frappe.db.get_value(doctype, docname, field);
    return value.message[field];
}

function passFrm(frm) {
    console.log(frm);
}

function setValueLink(fieldname) { }

async function addChild(frm, child_fieldname, object_data, add_row) {
    const grid_fields = frm.fields_dict[child_fieldname].grid.fields_map;
    let promises = [];
    Object.entries(object_data).forEach(async (entry) => {
        const [key, value] = entry;
        console.log('key', key);
        console.log('value', value);
        const df = grid_fields[key];
        const fetch_dict = frm.fetch_dict[df.parent];
        add_row[key] = object_data[key];
        if (df.fieldtype == 'Link') {
            console.log('inside link fieldtype');
            promises.push(
                getFetchValue(fetch_dict, grid_fields, key, object_data[key]).then((fetching_value) => {
                    Object.entries(fetching_value).forEach(([key, value]) => {
                        // perform logic here
                        add_row[key] = value;
                    });
                })
            );
        } else {
        }
    });

    await Promise.all(promises);
    frm.refresh_field(child_fieldname);
    return add_row;
}

async function getTenantID(data) {
    data.forEach(async (d) => {
        let tenant = await frappe.db.get_value(
            'Tenant',
            { project_reference: d['Project ID Tenant'] },
            'name'
        );
        d['Tenant ID Oneflux'] = tenant.message.name;
        // arr.push(obj)
    });
    return data;
}

async function validateSiteDF(grid_row) {
    let d = grid_row.doc;
    grid_row.docfields.forEach((df) => {

        if (d.new_tower_info == 'Yes') {
            if (['tower_height'].includes(df.fieldname)) {
                df.read_only = 0;
                df.reqd = 1;
            }
        } else if (d.new_tower_info == 'No') {
            if (['tower_height'].includes(df.fieldname)) {
                df.read_only = 1;
                df.reqd = 0;
            }
        }


        // site_id_reference
        if (d.input_order == 'New Site') {
            if (['site_id_reference'].includes(df.fieldname)) {
                df.read_only = 1;
                df.reqd = 0;
            }
        } else if (d.input_order == 'Existing Site') {
            if (['site_id_reference'].includes(df.fieldname)) {
                df.read_only = 0;
                df.reqd = 1;
            }
        }

        // max_radius
        if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
            if (['max_radius'].includes(df.fieldname)) {
                df.read_only = 0;
            }
        } else if (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site') {
            if (['max_radius'].includes(df.fieldname)) {
                df.read_only = 0;
            }
        } else if (
            (d.input_order == 'Existing Site' && d.change_site_loc == 'No') ||
            d.change_site_loc == 'Target Existing Site'
        ) {
            if (['max_radius'].includes(df.fieldname)) {
                df.read_only = 1;
            }
        }

        // latlong
        if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
            if (['latlong'].includes(df.fieldname)) {
                df.reqd = 1;
            }
        } else if (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site') {
            if (['latlong'].includes(df.fieldname)) {
                df.reqd = 1;
            }
        } else if (
            (d.input_order == 'Existing Site' && d.change_site_loc == 'No') ||
            d.change_site_loc == 'Target Existing Site'
        ) {
            if (['latlong'].includes(df.fieldname)) {
                df.read_only = 1;
            }
        }

        // area, city_or_regency, province, region, site_address
        if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
            if (['area'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['city_or_regency'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['province'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['region'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['site_address'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['district'].includes(df.fieldname)) {
                df.reqd = 1;
            }
        } else if (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site') {
            if (['area'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['city_or_regency'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['province'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['region'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['site_address'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['district'].includes(df.fieldname)) {
                df.reqd = 1;
            }
        } else if (
            d.input_order == 'Existing Site' &&
            (d.change_site_loc == 'No' || d.change_site_loc == 'Target Existing Site')
        ) {
            if (['area'].includes(df.fieldname)) {
                df.read_only = 1;
            }
            if (['city_or_regency'].includes(df.fieldname)) {
                df.read_only = 1;
            }
            if (['province'].includes(df.fieldname)) {
                df.read_only = 1;
            }
            if (['region'].includes(df.fieldname)) {
                df.read_only = 1;
            }
            if (['site_address'].includes(df.fieldname)) {
                df.read_only = 1;
            }
            if (['district'].includes(df.fieldname)) {
                df.read_only = 1;
            }
        }

        // site_id_target
        if (d.change_site_loc == 'No' || d.change_site_loc == 'Yes') {
            if (['site_id_target'].includes(df.fieldname)) {
                df.read_only = 1;
            }
        } else if (d.change_site_loc == 'Target Existing Site') {
            if (['site_id_target'].includes(df.fieldname)) {
                df.reqd = 1;
            }
        }

        // site_id_tenant, site_name_tenant (all mandatory, except additional)
        if (d.tenant_options == 'Existing Tenant Modification') {
            if (['site_id_tenant'].includes(df.fieldname)) {
                df.reqd = 0;
            }
            if (['site_name_tenant'].includes(df.fieldname)) {
                df.reqd = 0;
            }
        } else {
            if (['site_id_tenant'].includes(df.fieldname)) {
                df.reqd = 1;
            }
            if (['site_name_tenant'].includes(df.fieldname)) {
                df.reqd = 1;
            }
        }

        // tower_type
        if (
            d.change_site_loc == 'No' ||
            (d.change_site_loc == 'Target New Site' && d.new_tower_info == 'Yes')
        ) {
            if (['tower_type'].includes(df.fieldname)) {
                df.read_only = 0;
                df.reqd = 0;
            }
        } else if (d.change_site_loc == 'No' && d.new_tower_info == 'No') {
            if (['tower_type'].includes(df.fieldname)) {
                df.read_only = 1;
                df.reqd = 0;
            }
        } else if (d.change_site_loc == 'Target Existing Site' && d.new_tower_info == 'No') {
            if (['tower_type'].includes(df.fieldname)) {
                df.read_only = 1;
                df.reqd = 0;
            }
        }

        // tp_name (Tower Owner)
        if (
            d.input_order == 'New Site' &&
            d.change_site_loc == 'No' &&
            d.check_site_on == 'Non Mitratel'
        ) {
            if (['tp_name'].includes(df.fieldname)) {
                df.read_only = 0;
                df.reqd = 1;
            }
        } else if (
            d.input_order == 'New Site' &&
            d.change_site_loc == 'No' &&
            d.check_site_on == 'Mitratel'
        ) {
            d.tp_name = 'MITRATEL';
        } else if (
            d.input_order == 'Existing Site' &&
            (d.change_site_loc == 'No' || d.change_site_loc == 'Target New Site') &&
            (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
        ) {
            if (['tp_name'].includes(df.fieldname)) {
                df.read_only = 1;
                df.reqd = 0;
            }
        } else if (
            d.input_order == 'Existing Site' &&
            d.change_site_loc == 'Target Existing Site' &&
            (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
        ) {
            if (['tp_name'].includes(df.fieldname)) {
                df.read_only = 1;
                df.reqd = 0;
            }
        }
    });
}

function update_af_status(frm) {

    frappe.call({
        method: "compare_annulled_af",
        args: {
            "kom_name": frm.doc.name,
        },
        callback: function (response) {
            console.log(response)
            if (response.message.length > 0) {
                // frappe.msgprint(response.message);
                let afs = response.message
                let list = response.message.join(" <li> ")
                frappe.confirm(`There are Application Form(s) that is Annulled and not yet updated in KOM Site List: <br><ul><li>${list}<ul><br><br>Do you want to continue to remove site list that is Annulled?`,
                    () => {
                        afs.forEach(async (af) => {
                            console.log(af)
                            await frappe.call({
                                method: "cancel_annul_af",
                                args: {
                                    // "af_type": 'single',
                                    "af_name": af[0],
                                },
                                callback: function (response) {
                                    console.log(response.message)
                                    if (response.message == 'success') {
                                        //  frappe.msgprint(response.message);
                                        frappe.msgprint({
                                            title: __('Notification'),
                                            indicator: 'green',
                                            message: __('The site list already removed in KOM. Please refresh and click Update Application Form status again.')
                                        });
                                    }
                                },
                            });



                        })

                    })


            }
            else {
                frappe.call({
                    method: "update_af_status_kom",
                    args: {
                        "kom_name": frm.doc.name,
                    },
                    callback: function (response) {
                        console.log(response.message)
                        if (response.message == 'success') {
                            //  frappe.msgprint(response.message);
                            frappe.msgprint({
                                title: __('Notification'),
                                indicator: 'green',
                                message: __('Status Updated! Please refresh the page.')
                            });


                        }
                    },
                });
            }
        },
    });


}


frappe.ui.form.on('Kick Off Meeting', {
    before_save: function (frm, cdt, cdn) {
        cur_frm.refresh_field('collo_list');
        if (frm.doc.product_catalog) {
            cur_frm.set_value('number_of_sites', frm.doc.kom_sitelist.length);
        }
    },

    update_af: function (frm, cdt, cdn) {
        console.log("button pressed")
        update_af_status(frm)
        // frm.doc.reload()
    },

    refresh: function (frm, cdt, cdn) {
        console.log('test kom');
        $("[data-doctype='Application Form']").find('.btn-new').hide();
        $('*[data-fieldname="additional_services_list"]').find('.grid-add-row').hide();
        cur_frm.get_field('additional_services_list').grid.cannot_add_rows = true;
        frm.get_field('additional_services_list').grid.cannot_add_rows = true;

        console.log(frm);

        if (!frm.doc.__unsaved) {
            cur_frm.fields_dict['kom_sitelist'].grid.grid_pagination.go_to_page(1);

            frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
                validateSiteDF(grid_row);

                frm.refresh_field('kom_sitelist');
            });
        }

        $('.grid-pagination').click(() => {
            console.log('page event');
            console.log(cur_frm.fields_dict['kom_sitelist'].grid.grid_rows);
            let page_index = cur_frm.fields_dict['kom_sitelist'].grid.grid_pagination.page_index;
            let page_length = cur_frm.fields_dict['kom_sitelist'].grid.grid_pagination.page_length;
            let total_pages = cur_frm.fields_dict['kom_sitelist'].grid.grid_pagination.total_pages;

            let start_index = (page_index - 1) * page_length;
            let end_index = start_index + page_length;

            if (page_index === total_pages) {
                end_index = cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.length;
            }

            let pageData = cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.slice(
                start_index,
                end_index
            );
            pageData.forEach((grid_row) => {
                validateSiteDF(grid_row);
            });
            frm.refresh_field('kom_sitelist');
        });


        frm.item_variants_filter_child = {};

        if (frm.doc.attach_excel) {
            frm.trigger('show_preview_xls');
        }

        if (frm.doc.docstatus != 1) {
            frm.fields_dict['kom_sitelist'].grid.add_custom_button(__('Add Bulk Sites'), function () {
                console.log('Add Bulk Sites');
                function processRowSites(item) {
                    return new Promise((resolve, reject) => {
                        // Simulate an async operation, e.g., API call, database operation, etc.
                        // Perform your checks here. If successful, resolve; otherwise, reject.
                        console.log(item);
                        console.log("Check item");
                        if (item) {
                            // Replace this condition with your actual logic
                            resolve('Success: ' + item);

                            if (item['Product Scope']) {
                                let child_add_site = cur_frm.add_child('kom_sitelist');
                                frappe.model.set_value(
                                    child_add_site.doctype,
                                    child_add_site.name,
                                    'product_scope',
                                    item['Product Scope']
                                );
                            }

                            frm.refresh_field('kom_sitelist');
                        } else {
                            reject('Failed: ' + item);
                        }
                    });
                }

                let dialog = new frappe.ui.Dialog({
                    title: 'Excel Import Tools',
                    width: '150%',
                    fields: [
                        {
                            label: 'Download Excel Template',
                            fieldname: 'download',
                            fieldtype: 'Button'
                        },
                        {
                            label: 'Attach Excel',
                            fieldname: 'attach',
                            fieldtype: 'Attach',
                            reqd: true
                        },
                        {
                            label: 'More',
                            fieldname: 'section',
                            fieldtype: 'Section Break',
                            collapsible: 1,
                            collapsed: 1
                        },
                        {
                            label: 'Preview Excel',
                            fieldname: 'button',
                            fieldtype: 'Button'
                        },

                        {
                            label: 'HTML',
                            fieldname: 'html',
                            fieldtype: 'HTML'
                        }
                    ],
                    primary_action_label: 'Submit',
                    primary_action: async (values) => {
                        let index = 1;

                        let response = await new frappe.call({
                            method: 'excel_to_object',
                            args: {
                                url: values.attach
                            },
                            async: false,
                            callback: (response) => {
                                console.log(response.message);
                            }
                        });

                        // Define required columns that must be present in the file
                        const requiredColumns = [
                            "No",
                            "Product Scope",
                            "Contract",
                            "Duration to RFC (days)",
                            "Duration to RFI (days)",
                            "Site ID Tenant",
                            "Site Name Tenant",
                            "Latitude & Longitude",
                            "Site ID Reference",
                            "Site ID Target",
                            "Height Request (m)",
                            "Notes/Reason",
                            "Ladder Type",
                            "Ladder"
                        ];

                        // Get columns from the uploaded file (from the first row/header)
                        let fileColumns = [];
                        if (response.message && response.message.length > 0) {
                            fileColumns = Object.keys(response.message[0]);
                        }

                        const missingColumns = requiredColumns.filter(col => !fileColumns.includes(col));

                        // If any columns are missing, pop up throw error
                        if (missingColumns.length > 0) {
                            let errorMsg = 'Invalid Excel template. The following columns were not found:<br>';
                            missingColumns.forEach(col => {
                                errorMsg += `- ${col}<br>`;
                            });
                            dialog.hide();
                            frappe.throw(__(errorMsg));
                            return;
                        }

                        // Get Product Catalog
                        let validProductScopes = [];

                        await frappe.db.get_list('Catalog', {
                            fields: ['name'],
                            filters: [
                                ['status', '=', 'Product Scope'],
                                ['parent_catalog', '=', frm.doc.product_catalog]
                            ]
                        }).then(result => {
                            validProductScopes = result.map(item => item.name);
                        });

                        // Compare row values product scope with product catalog
                        let invalidScopes = [];
                        let validrow = [];
                        response.message.forEach((row, index) => {
                            if (row['Product Scope'] && !validProductScopes.includes(row['Product Scope'])) {
                                invalidScopes.push({
                                    row: index + 1,
                                    value: row['Product Scope']
                                });
                                // For idx only
                                // invalidScopes.push(index + 1);
                            } else if (row['Product Scope'] && row['Contract']) {
                                validrow.push(row); // Only include valid rows
                            }
                        });

                        // Show error message for invalid scopes but continue execution
                        if (invalidScopes.length > 0) {
                            let errorMsg = 'Found invalid Product Scope values in the following rows:<br>';
                            invalidScopes.forEach(item => {
                                errorMsg += `Row ${item.row}: "${item.value}" is not a valid Product Scope for ${frm.doc.product_catalog}<br>`;
                            });
                            // let errorMsg = `Found invalid Product Scope values in rows: ${invalidScopes.join(', ')}`;
                            // dialog.hide();
                            frappe.msgprint(__(errorMsg));
                        }
                        let total_row = invalidScopes.length + validrow.length
                        cur_frm.clear_table('kom_sitelist');
                        let progress = await frappe.show_progress('Importing..', index, validrow.length, 'Please wait');
                        if (total_row !== invalidScopes.length) {
                            $(progress.$wrapper).find('.btn-modal-close').remove();
                            $(progress.$wrapper).modal('dispose').modal({
                                backdrop: 'static',
                                keyboard: false,
                                show: true
                            });
                        }

                        const loopPromises = validrow.map(async (data, i) => {
                            let obj_data = {};
                            try {
                                const d = frm.add_child('kom_sitelist');
                                obj_data['product_scope'] = data['Product Scope'];
                                obj_data['contract'] = data['Contract'];
                                obj_data['notes_or_reason'] = data['Notes/Reason'];

                                let row = await addChild(frm, 'kom_sitelist', obj_data, d);

                                // if (d.new_tower_info == 'Yes') {
                                if (!data['Tower Height (m)']) {

                                } else {
                                    await frappe.model.set_value(
                                        d.doctype,
                                        d.name,
                                        'tower_height',
                                        data['Tower Height (m)']
                                    );
                                }

                                if (!data['Height Request (m)']) {
                                    throw {
                                        error: 'throw',
                                        message: `Column Height Height (m) cannot be empty at Row ${i + 1}!`
                                    };
                                } else {
                                    await frappe.model.set_value(
                                        d.doctype,
                                        d.name,
                                        'height_request',
                                        data['Height Request (m)']
                                    );
                                }

                                // site_id_reference
                                if (d.input_order == 'New Site') {

                                } else if (d.input_order == 'Existing Site') {
                                    if (!data['Site ID Reference']) {
                                        throw {
                                            error: 'throw',
                                            message: `Site ID Reference cannot be empty at Row ${i + 1}!`
                                        };
                                        //   continue
                                    } else {
                                        await frappe.model.set_value(
                                            d.doctype,
                                            d.name,
                                            'site_id_reference',
                                            data['Site ID Reference']
                                        );
                                    }
                                }

                                // max_radius
                                if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
                                } else if (
                                    d.input_order == 'Existing Site' &&
                                    d.change_site_loc == 'Target New Site'
                                ) {
                                } else if (
                                    (d.input_order == 'Existing Site' && d.change_site_loc == 'No') ||
                                    d.change_site_loc == 'Target Existing Site'
                                ) {
                                }

                                // latlong
                                if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
                                    if (!data['Latitude & Longitude']) {
                                        throw {
                                            error: 'throw',
                                            message: `Column Latitude & Longitude cannot be empty at Row ${i + 1
                                                }!`
                                        };
                                    } else {
                                        const regexExp =
                                            /^((\-?|\+?)?\d+(\.\d+)?),\s*((\-?|\+?)?\d+(\.\d+)?)$/gi;
                                        if (!regexExp.test(data['Latitude & Longitude'])) {
                                            await frappe.model.set_value(d.doctype, d.name, 'latlong', '');
                                            frappe.throw(
                                                __(
                                                    'Latitude and Longitude is not valid! Format: Lattitude, Longitude (in Signed Degree) e.g. -6.32216, 106.67569'
                                                )
                                            );
                                            throw {
                                                error: 'throw',
                                                message: `Latitude and Longitude is not valid at Row ${i + 1
                                                    }! Format: Lattitude, Longitude (in Signed Degree) e.g. -6.32216, 106.67569`
                                            };
                                        } else {


                                            await frappe.model.set_value(
                                                d.doctype,
                                                d.name,
                                                'latlong',
                                                data['Latitude & Longitude']
                                            );
                                        }
                                    }
                                } else if (
                                    d.input_order == 'Existing Site' &&
                                    d.change_site_loc == 'Target New Site'
                                ) {
                                    if (!data['Latitude & Longitude']) {
                                        throw {
                                            error: 'throw',
                                            message: `Column Latitude & Longitude cannot be empty at Row ${i + 1
                                                }!`
                                        };
                                    } else {
                                        const regexExp =
                                            /^((\-?|\+?)?\d+(\.\d+)?),\s*((\-?|\+?)?\d+(\.\d+)?)$/gi;
                                        if (!regexExp.test(data['Latitude & Longitude'])) {
                                            await frappe.model.set_value(d.doctype, d.name, 'latlong', '');
                                            frappe.throw(
                                                __(
                                                    'Latitude and Longitude is not valid! Format: Lattitude, Longitude (in Signed Degree) e.g. -6.32216, 106.67569'
                                                )
                                            );
                                            throw {
                                                error: 'throw',
                                                message: `Latitude and Longitude is not valid at Row ${i + 1
                                                    }! Format: Lattitude, Longitude (in Signed Degree) e.g. -6.32216, 106.67569`
                                            };
                                        } else {


                                            await frappe.model.set_value(
                                                d.doctype,
                                                d.name,
                                                'latlong',
                                                data['Latitude & Longitude']
                                            );
                                        }
                                    }
                                } else if (
                                    (d.input_order == 'Existing Site' && d.change_site_loc == 'No') ||
                                    d.change_site_loc == 'Target Existing Site'
                                ) {
                                }

                                // area, city_or_regency, province, region, site_address
                                if (d.input_order == 'New Site' && d.change_site_loc == 'No') {

                                } else if (
                                    d.input_order == 'Existing Site' &&
                                    d.change_site_loc == 'Target New Site'
                                ) {

                                } else if (
                                    d.input_order == 'Existing Site' &&
                                    (d.change_site_loc == 'No' ||
                                        d.change_site_loc == 'Target Existing Site')
                                ) {

                                }

                                // site_id_target
                                if (d.change_site_loc == 'No') {
                                } else if (d.change_site_loc == 'Target Existing Site') {
                                    if (!data['Site ID Target']) {
                                        throw {
                                            error: 'throw',
                                            message: `Site ID Target cannot be empty at Row ${i + 1}!`
                                        };
                                        //   continue
                                    } else {
                                        await frappe.model.set_value(
                                            d.doctype,
                                            d.name,
                                            'site_id_target',
                                            data['Site ID Target']
                                        );
                                    }
                                }

                                // site_id_tenant, site_name_tenant (all mandatory, except additional)
                                if (d.tenant_options == 'Existing Tenant Modification') {
                                } else {
                                    if (!data['Site ID Tenant']) {
                                        throw {
                                            error: 'throw',
                                            message: `Column Site ID Tenant cannot be empty at Row ${i + 1}!`
                                        };
                                        //   continue
                                    } else {
                                        await frappe.model.set_value(
                                            d.doctype,
                                            d.name,
                                            'site_id_tenant',
                                            data['Site ID Tenant']
                                        );
                                    }

                                    if (!data['Site Name Tenant']) {
                                        throw {
                                            error: 'throw',
                                            message: `Column Site Name Tenant cannot be empty at Row ${i + 1}!`
                                        };
                                        //   continue
                                    } else {
                                        await frappe.model.set_value(
                                            d.doctype,
                                            d.name,
                                            'site_name_tenant',
                                            data['Site Name Tenant']
                                        );
                                    }
                                }

                                // tower_type
                                if (
                                    d.change_site_loc == 'No' ||
                                    (d.change_site_loc == 'Target New Site' && d.new_tower_info == 'Yes')
                                ) {
                                } else if (d.change_site_loc == 'No' && d.new_tower_info == 'No') {
                                } else if (
                                    d.change_site_loc == 'Target Existing Site' &&
                                    d.new_tower_info == 'No'
                                ) {
                                }

                                // tp_name (Tower Owner)
                                if (
                                    d.input_order == 'New Site' &&
                                    d.change_site_loc == 'No' &&
                                    d.check_site_on == 'Non Mitratel'
                                ) {
                                } else if (
                                    d.input_order == 'New Site' &&
                                    d.change_site_loc == 'No' &&
                                    d.check_site_on == 'Mitratel'
                                ) {
                                    d.tp_name = 'MITRATEL';
                                } else if (
                                    d.input_order == 'Existing Site' &&
                                    (d.change_site_loc == 'No' || d.change_site_loc == 'Target New Site') &&
                                    (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
                                ) {
                                } else if (
                                    d.input_order == 'Existing Site' &&
                                    d.change_site_loc == 'Target Existing Site' &&
                                    (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
                                ) {
                                }

                                index++;
                                await frappe.show_progress(
                                    'Importing..',
                                    index,
                                    validrow.length,
                                    `Please wait... processing row: ${index - 1} of ${validrow.length}`
                                );
                                //await frappe.show_progress('Importing..', i+1, validrow.length, `Please wait... processing row: ${i} of ${validrow.length}`);
                                // progress.update('Importing..', index, validrow.length, `Please wait... processing row: ${index-1} of ${validrow.length}`);
                                // $(progress.$wrapper).find('.btn-modal-close').remove();
                                //         		progress.$wrapper.modal({backdrop: 'static', keyboard: false});

                                if (
                                    !data['Duration to RFC (days)'] ||
                                    !data['Duration to RFI (days)'] ||
                                    !data['Notes/Reason']
                                ) {
                                    throw {
                                        error: 'throw',
                                        message: `Column Duration to RFC (days), Duration to RFI (days), or Notes/Reason cannot be empty at Row ${i + 1
                                            }!`
                                    };
                                } else {
                                    await frappe.model.set_value(
                                        d.doctype,
                                        d.name,
                                        'duration_rfc',
                                        data['Duration to RFC (days)']
                                    );
                                    await frappe.model.set_value(
                                        d.doctype,
                                        d.name,
                                        'duration_rfi',
                                        data['Duration to RFI (days)']
                                    );
                                }


                            } catch (e) {
                                console.log(e);
                                if (e.error == 'throw') {
                                    dialog.hide();
                                    frappe.throw(__(`Row ${i + 1}: ` + e.message));
                                }
                            }
                        });

                        await Promise.allSettled(loopPromises).then(async () => {
                            let index = 0;

                            await frappe.show_progress(
                                'Importing..',
                                100,
                                100,
                                'Please wait for a moment'
                            );

                            for (const d of frm.doc.kom_sitelist) {
                                index++;

                                if (frm.doc.kom_sitelist.length > 50 && index % 50 === 1) {
                                    cur_frm.fields_dict[
                                        'kom_sitelist'
                                    ].grid.grid_pagination.render_next_page();
                                }

                                let grid_row =
                                    frm.fields_dict['kom_sitelist'].grid.grid_rows_by_docname[d.name];
                                console.log('gridrow bulk after promise', grid_row);
                                validateSiteDF(grid_row);
                            }

                            frm.refresh_field('kom_sitelist');

                        });
                        console.log(frm.doc.kom_sitelist);

                        console.log(frm.item_variants_filter_child);

                        console.log(cur_frm);

                        frappe.hide_progress();
                        dialog.hide();
                        // 			$(progress.$wrapper).modal.hide()
                        $('.modal-backdrop').hide();
                        $('body').removeClass('modal-open');
                    }
                });

                const button_download = dialog.fields_dict.download.input;
                let base_url = frappe.urllib.get_base_url();
                button_download.addEventListener('click', function () {
                    // window.open(base_url + "/private/files/Template Bulk Upload Site List.xlsx", '_blank');
                    var a = document.createElement('a');
                    a.href = base_url + '/files/Template Bulk Upload Site List5e4023.xlsx';
                    a.download = 'Template Bulk Upload Site List.xlsx';
                    a.target = '_blank';

                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    console.log('Button download clicked');
                });

                if (frm.doc.product_catalog && frm.doc.customer) {
                    const button = dialog.fields_dict.button.input;
                    button.addEventListener('click', function () {
                        console.log('Example button clicked');
                        let attach_fileurl = dialog.get_field('attach').get_value();
                        console.log(attach_fileurl);
                        const html_field = dialog.get_field('html');

                        if (attach_fileurl) {
                            html_field.set_value(
                                '<table class="display" id="table_dialog" style="width: 100%;"></table>'
                            );
                            let dynamicColumns = [];
                            let dt;
                            const jQueryDatatableStyle = document.createElement('link');
                            jQueryDatatableStyle.rel = 'stylesheet';
                            jQueryDatatableStyle.type = 'text/css';
                            jQueryDatatableStyle.href =
                                'https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css';
                            jQueryDatatableStyle.onload = function () {
                                console.log('jQuery Datatable Style Loaded');
                            };
                            document.head.appendChild(jQueryDatatableStyle);

                            $.getScript(
                                'https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js',
                                function () {
                                    let array_data = [];
                                    frappe.call({
                                        method: 'excel_to_array',
                                        args: {
                                            url: attach_fileurl
                                        },
                                        async: false,
                                        callback: (response) => {
                                            // console.log(response.message);
                                            array_data = response.message;
                                        },
                                        error: (r) => {
                                            // on error
                                            console.log(r);
                                        }
                                    });

                                    var data = array_data.slice(1);
                                    var column_data = array_data[0];
                                    console.log(column_data);
                                    column_data.forEach(function (column_item) {
                                        // extract the column definitions:
                                        // 		console.log(column_item)
                                        if (column_item) {
                                            var column = {};
                                            column['title'] = column_item;
                                            dynamicColumns.push(column);
                                        }
                                    });

                                    $(document).ready(function () {
                                        dt = $('#table_dialog').DataTable({
                                            processing: true,
                                            scrollX: true,
                                            data: data,
                                            columns: dynamicColumns,
                                            order: []
                                        });
                                        var detailRows = [];
                                        console.log('Table Loaded.');
                                    });
                                }
                            );
                        } else {
                            html_field.set_value('<p>Please attach the excel file first</p>');
                        }
                    });

                    dialog.show();
                    dialog.$wrapper.find('.modal-dialog').css('max-width', '66vw');
                    dialog.$wrapper.find('.modal-dialog').css('width', '66vw');
                } else {
                    frappe.throw(__('Please fill the Product Catalog and Customer first!'));
                }
            });
        }

        let base_url = frappe.urllib.get_base_url();
        //Script for show Import Tools action
        if (frm.doc.workflow_state == 'Waiting Update E-CAF') {
            //function Promise to call the Excel Template

            let get_templates = () => {
                return new Promise((resolve, reject) => {
                    frappe.call({
                        method: 'frappe.client.get_list',
                        args: {
                            doctype: 'Excel Template',
                            filters: [
                                ['associated_doctype', '=', frm.doc.doctype],
                                ['disabled', '=', false]
                            ],
                            fields: ['*']
                        },
                        callback: function (response) {
                            if (response.message) {
                                resolve(response.message);
                            } else {
                                reject(response);
                            }
                        }
                    });
                });
            };

            //script to dialog pop up for import action
            frm.add_custom_button(
                __('Import'),
                function () {
                    let dialog = new frappe.ui.Dialog({
                        title: 'Excel Import Tools',
                        width: '150%',
                        fields: [
                            {
                                label: 'Attach Excel',
                                fieldname: 'attach',
                                fieldtype: 'Attach',
                                reqd: true
                            },
                            {
                                label: 'More',
                                fieldname: 'section',
                                fieldtype: 'Section Break',
                                collapsible: 1,
                                collapsed: 1
                            },
                            {
                                label: 'Preview Excel',
                                fieldname: 'button',
                                fieldtype: 'Button'
                            },

                            {
                                label: 'HTML',
                                fieldname: 'html',
                                fieldtype: 'HTML'
                            }
                        ],
                        primary_action_label: 'Submit',
                        primary_action: async (values) => {
                            let response = await new frappe.call({
                                method: 'excel_to_object',
                                args: {
                                    url: values.attach
                                },
                                async: false,
                                callback: (response) => {
                                    console.log(response.message);
                                }
                            });
                            console.log(response.message);
                            let grouped_new;
                            let index = 1;
                            let data_clean = response.message;
                            grouped_new = groupByNew(data_clean);
                            //do the async process iteration and call show.progress
                            const loopPromises = grouped_new.map(async (data) => {
                                let obj_data = {};
                                obj_data['site_id_tenant'] = data.site_id_tenant;
                                obj_data['notes_or_reason'] = data.notes;
                                obj_data['device_objec'] = JSON.stringify(data.device_object);
                                if (data.site_id_tenant) {
                                    let sitelist = frm.doc.kom_sitelist;
                                    let sitelist_data = frm.doc.kom_sitelist.map((d) => d.site_id_tenant);
                                    let index = sitelist_data.indexOf(data.site_id_tenant);
                                    if (index >= 0) {
                                        let child = sitelist[index];
                                        frm.doc.kom_sitelist[index].notes = data.notes;
                                        frm.doc.kom_sitelist[index].notes_or_reason = data.notes;
                                        frm.doc.kom_sitelist[index].device_objec = JSON.stringify(
                                            data.device_object
                                        );
                                        frm.refresh_field('kom_sitelist');

                                    } else {
                                        console.log('not found');
                                    }
                                }
                            });
                            await Promise.all(loopPromises);
                            if (frm.doc.kom_sitelist) {
                                for (const d of frm.doc.kom_sitelist) {
                                    await setItemVariant('tower_height', d, frm);
                                    await setItemVariant('height_request', d, frm);
                                }
                            }

                            cur_frm.set_value('excel_caf_import', '');
                            console.log('value attach', values.attach);
                            cur_frm.set_value('excel_caf_import', values.attach);
                            // }
                            frappe.hide_progress();
                            dialog.hide();
                        }
                    });

                    const button = dialog.fields_dict.button.input;
                    button.addEventListener('click', function () {
                        console.log('Example button clicked');
                        // dialog.fields_dict.html.$wrapper.html("<p>Example button clicked.</p>");
                        let attach_fileurl = dialog.get_field('attach').get_value();
                        console.log(attach_fileurl);
                        const html_field = dialog.get_field('html');
                        // dialog.fields_dict.html.input.refresh();
                        // frappe.show_progress('Loading..', 70, 100, 'Please wait');

                        if (attach_fileurl) {
                            html_field.set_value(
                                '<table class="display" id="table_dialog" style="width: 100%;"></table>'
                            );
                            let dynamicColumns = [];
                            let dt;
                            const jQueryDatatableStyle = document.createElement('link');
                            jQueryDatatableStyle.rel = 'stylesheet';
                            jQueryDatatableStyle.type = 'text/css';
                            jQueryDatatableStyle.href =
                                'https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css';
                            jQueryDatatableStyle.onload = function () {
                                console.log('jQuery Datatable Style Loaded');
                            };
                            document.head.appendChild(jQueryDatatableStyle);

                            $.getScript(
                                'https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js',
                                function () {
                                    let array_data = [];
                                    frappe.call({
                                        method: 'excel_to_array',
                                        args: {
                                            url: attach_fileurl
                                        },
                                        async: false,
                                        callback: (response) => {
                                            // console.log(response.message);
                                            array_data = response.message;
                                        },
                                        error: (r) => {
                                            // on error
                                            console.log(r);
                                        }
                                    });

                                    var data = array_data.slice(1);
                                    var column_data = array_data[0];
                                    console.log(column_data);
                                    column_data.forEach(function (column_item) {
                                        // extract the column definitions:
                                        var column = {};
                                        column['title'] = column_item;
                                        dynamicColumns.push(column);
                                    });

                                    $(document).ready(function () {
                                        dt = $('#table_dialog').DataTable({
                                            processing: true,
                                            scrollX: true,
                                            data: data,
                                            columns: dynamicColumns,
                                            order: []
                                        });
                                        var detailRows = [];
                                        console.log('Table Loaded.');
                                    });
                                }
                            );
                        } else {
                            html_field.set_value('<p>Please attach the excel file first</p>');
                        }
                    });

                    dialog.show();
                    dialog.$wrapper.find('.modal-dialog').css('max-width', '66vw');
                    dialog.$wrapper.find('.modal-dialog').css('width', '66vw');

                    const attach_field = dialog.get_field('attach');
                    attach_field.$wrapper.on('blur', 'input[type="file"]', (e) => {
                        // do something with the attach field's value
                        console.log('test');
                    });
                },
                __('Excel Import')
            );
            let headline =
                'Please note, this following Application Form still in status of capacity and strengthening checking by Asset and Solution Engineering: <br>';
            frappe.db
                .get_list('Application Form', {
                    fields: ['name', 'workflow_state'],
                    filters: {
                        kom_reference: frm.doc.name,
                        workflow_state: ['not in', ['Draft', 'Submitted', 'Cancelled', 'Annulled']]
                    }
                })
                .then((records) => {
                    records.forEach((r) => {
                        headline = headline + '<br>' + r.name + ': ' + '<b>' + r.workflow_state + '</b>';
                    });
                    frm.dashboard.set_headline(
                        __(headline),
                        '<a id="jump_to_error" style="text-decoration: underline;">issue</a>'
                    );
                });
        } else {

        }
    },

    validate: function (frm, cdt, cdn) {
        console.log('inside validation');
        let index = 0;
        for (const d of frm.doc.kom_sitelist) {
            index++;

            if (frm.doc.kom_sitelist.length > 50 && index % 50 === 1) {
                cur_frm.fields_dict['kom_sitelist'].grid.grid_pagination.render_next_page();
            }

            let grid_row = frm.fields_dict['kom_sitelist'].grid.grid_rows_by_docname[d.name];
            console.log('gridrow bulk after promise', grid_row);
            validateSiteDF(grid_row);
        }
    },



    before_workflow_action: async (frm) => {
        let promise = new Promise((resolve, reject) => {
            let dialog = new frappe.ui.Dialog({
                title: 'Approval Comment',
                fields: [
                    {
                        label: 'HTML',
                        fieldname: 'html',
                        fieldtype: 'HTML'
                    },
                    {
                        label: 'Add Comment',
                        fieldname: 'add_comment',
                        fieldtype: 'Small Text',
                        reqd: true
                    }
                ],
                primary_action_label: 'Send',
                primary_action(value) {
                    var apr_by = frappe.user.name;
                    var content =
                        'Approved by: ' + apr_by + '</br>' + 'Comment: ' + value['add_comment'];
                    frappe.call({
                        method: 'frappe.desk.form.utils.add_comment',
                        args: {
                            reference_doctype: frm.doctype,
                            reference_name: frm.docname,
                            content: content,
                            comment_email: frappe.session.user,
                            comment_by: frappe.session.user_fullname
                        }
                    });
                    resolve();
                    dialog.hide();
                }
            });

            let dialog_ecaf = new frappe.ui.Dialog({
                title: 'Create ECAF Comment',
                fields: [
                    {
                        label: 'HTML',
                        fieldname: 'html',
                        fieldtype: 'HTML'
                    },
                    {
                        label: 'Add Comment',
                        fieldname: 'add_comment',
                        fieldtype: 'Small Text',
                        reqd: true
                    }
                ],
                primary_action_label: 'Send',
                primary_action(value) {
                    var apr_by = frappe.user.name;
                    var content = 'Created by: ' + apr_by + '</br>' + 'Comment: ' + value['add_comment'];
                    frappe.call({
                        method: 'frappe.desk.form.utils.add_comment',
                        args: {
                            reference_doctype: frm.doctype,
                            reference_name: frm.docname,
                            content: content,
                            comment_email: frappe.session.user,
                            comment_by: frappe.session.user_fullname
                        }
                    });
                    resolve();
                    dialog_ecaf.hide();
                }
            });

            let dialog_req = new frappe.ui.Dialog({
                title: 'Request Approval',
                fields: [
                    {
                        label: 'HTML',
                        fieldname: 'html',
                        fieldtype: 'HTML'
                    },
                    {
                        label: 'Add Comment',
                        fieldname: 'add_comment',
                        fieldtype: 'Small Text',
                        reqd: true
                    }
                ],
                primary_action_label: 'Send',
                primary_action(value) {
                    var apr_by = frappe.user.name;
                    var content =
                        'Requested by: ' + apr_by + '</br>' + 'Comment: ' + value['add_comment'];
                    frappe.call({
                        method: 'frappe.desk.form.utils.add_comment',
                        args: {
                            reference_doctype: frm.doctype,
                            reference_name: frm.docname,
                            content: content,
                            comment_email: frappe.session.user,
                            comment_by: frappe.session.user_fullname
                        }
                    });
                    resolve();
                    dialog_req.hide();
                }
            });

            let dialog_reject = new frappe.ui.Dialog({
                title: 'Rejection or Cancellation',
                fields: [
                    {
                        label: 'HTML',
                        fieldname: 'html',
                        fieldtype: 'HTML'
                    },
                    {
                        label: 'Add Comment',
                        fieldname: 'add_comment',
                        fieldtype: 'Small Text',
                        reqd: true
                    }
                ],
                primary_action_label: 'Send',
                primary_action(value) {
                    var apr_by = frappe.user.name;
                    var content = 'Rejected by: ' + apr_by + '</br>' + 'Reason: ' + value['add_comment'];
                    frappe.call({
                        method: 'frappe.desk.form.utils.add_comment',
                        args: {
                            reference_doctype: frm.doctype,
                            reference_name: frm.docname,
                            content: content,
                            comment_email: frappe.session.user,
                            comment_by: frappe.session.user_fullname
                        }
                    });
                    resolve();
                    dialog_reject.hide();
                }
            });

            if (frm.selected_workflow_action == 'Approve') {
                dialog.show();
            }

            else if (frm.selected_workflow_action == 'Create E-CAF') {
                dialog_ecaf.show();
            } else if (frm.selected_workflow_action == 'Cancel') {
                frappe.call({
                    method: 'kom_validate_cancellation',
                    args: {
                        name: frm.docname
                    },
                    async: false,
                    callback: (response) => {
                        // console.log(response.message);
                        console.log(response);
                        if (response.data == true) {
                            dialog_reject.show();
                        } else {
                            resolve();
                        }
                    },
                    error: (r) => {
                        // on error
                        console.log(r);
                    }
                });
            } else if (frm.selected_workflow_action == 'Send Sales Manager Approval') {
                // frm.dialog_content = "Appproved by: " + apr_by + "</br>"+ value['approval_comment'];
                dialog_req.show();

                // if (frm.doc.update_to_ap == 0 && frm.doc.workflow_state == "Waiting Update E-CAF") {
                //     let dialog_confirm = new frappe.confirm(
                //         'Are you sure to continue? You can not continue if you have not checked/updated the Application Form Device first!',
                //         function () {
                //             show_alert('After you check the field, please click the button again to continue');
                //             reject();
                //         },
                //         function () {
                //             show_alert('After you check the field, please click the button again to continue');
                //             reject();
                //         }
                //     );
                //     dialog_confirm.show();
                // }
                // else {
                //     resolve()
                // }
                // resolve()
            } else {
                resolve();
            }
        });
        await promise.catch(() => frappe.throw());
    },

    reload_preview: function (frm) {
        if (frm.doc.attach_excel) {
            frm.trigger('show_preview_xls');
        }
    },
    show_preview_xls: function (frm) {
        var dynamicColumns = [];
        var jQueryDatatableStyle = document.createElement('link');
        jQueryDatatableStyle.rel = 'stylesheet';
        jQueryDatatableStyle.type = 'text/css';
        jQueryDatatableStyle.href =
            'https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css';
        jQueryDatatableStyle.onload = function () {
            console.log('jQuery Datatable Style Loaded');
        };
        document.head.appendChild(jQueryDatatableStyle);

        $.getScript('https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js', function () {
            // -----------OLD METHOD----------
            // var string_data = frm.doc.data
            // var array_data = JSON.parse(frm.doc.data)
            // -----------OLD METHOD----------

            // -----------NEW METHOD-----------
            var array_data = [];
            frappe.call({
                method: 'excel_to_array',
                args: {
                    url: frm.doc.attach_excel
                },
                async: false,
                callback: (response) => {
                    // console.log(response.message);
                    array_data = response.message;
                },
                error: (r) => {
                    // on error
                    console.log(r);
                }
            });
            // -----------NEW METHOD-----------

            var data = array_data.slice(1);
            var column_data = array_data[0];
            console.log(column_data);
            column_data.forEach(function (column_item) {
                // extract the column definitions:
                var column = {};
                column['title'] = column_item;
                dynamicColumns.push(column);
            });
            // console.log(dynamicColumns)

            $(document).ready(function () {
                var dt = $('#example').DataTable({
                    processing: true,
                    scrollX: true,
                    data: data,
                    columns: dynamicColumns,
                    order: []
                });
                // Array to track the ids of the details displayed rows
                var detailRows = [];
            });
        });
        frm.refresh_field('preview_data');
    },

    // TECH-1235 - Tandigital
    download_template: async function (frm, cdt, cdn) {
        if (frm.doc.template_update_device == null) {
            frappe.msgprint({
                title: __('Notification'),
                message: __('Excel template not available')
            });
        } else {
            window.open(frm.doc.template_update_device, '_blank');
        }
    }
});

let item_variant_name = [];

async function setItemVariant(childHeightField, local_child, frm, updateFieldValue = true) {
    console.log("Get Item Variant Triggered")
    const d = local_child;
    // console.log("not complete")
    // frappe.model.set_value(d.doctype, d.name, "item_variant", "")
    const location_order = ['district_or_city', 'province', 'region', 'area'];
    function makeFilter(location, height) {
        // this["parent"] = frm.doc.contract
        // this.cos = frm.doc.class_of_service
        // this.heigh = height
        // this.group_by = location
        return {
            parent: d.contract,
            // 'heigh': height,
            group_by: ['in', ['All Territories', location]],
            item_variant: ['is', 'set']
        };
    }

    async function getItems(filters) {
        let result = [];
        await frappe.db
            .get_list('Item Details', {
                fields: ['*'],
                // filters: {'parent': frm.doc.contract, 'cos': frm.doc.class_of_service, 'heigh': d[childHeightField]},
                filters: filters,
                start: 0,
                limit: 500
            })
            .then((response) => {
                // console.log(response)
                result = response;
                // return response
            })
            .catch((err) => console.error(err));
        return result;
    }

    // console.log(d[childHeightField], d.area, d.region, d.province, d.city_or_regency, d.contract)
    if (d[childHeightField] && d.area && d.region && d.province && d.city_or_regency && d.contract) {
        let item_variants = [];
        let filter_item = {};
        if (frm.item_variants_filter_child[d.parentfield]) {
            // if(frm.item_variants_filter_child[d.parentfield][d.name]){
            //     filter_item = frm.item_variants_filter_child[d.parentfield][d.name]
            // }
            filter_item = frm.item_variants_filter_child[d.parentfield];
        }
        // console.log("frm item variant", frm.item_variants_filter_child)
        // console.log("filter item", filter_item)
        for (let i of location_order) {
            // console.log(makeFilter(d[i], d[childHeightField]))
            let loc = location_order[i];
            const items = await getItems(makeFilter(d[i], d[childHeightField]));

            // console.log(items)
            item_variant_name = [];
            filter_item[d.name] = item_variant_name;
            frm.item_variants_filter_child[d.parentfield] = filter_item;
            if (items.length > 0) {
                console.log("Item variant found")
                console.log(items)
                items.forEach((item) => {
                    if (item.heigh == d[childHeightField] || item.heigh == 0) {
                        item_variant_name.push(item.item_variant);
                    }
                });
                if (updateFieldValue) {
                    if (item_variant_name.length == 1) {
                        frappe.model.set_value(d.doctype, d.name, 'item_variant', item_variant_name[0]);
                    } else {
                        frappe.model.set_value(d.doctype, d.name, 'item_variant', '');
                    }
                }

                filter_item[d.name] = item_variant_name;
                frm.item_variants_filter_child[d.parentfield] = filter_item;
                // console.log("item variant child name", frm.item_variants_filter_child[d.parentfield])
                break;
            }
        }
        // return item_variants
    } else {
        console.log("not complete")
        if (frm.item_variants_filter_child[d.parentfield]) {
            frm.item_variants_filter_child[d.parentfield][d.name] = [];
        }
    }
}


frappe.ui.form.on('Kick Off Meeting', {
    setup: function (frm, cdt, cdn) {
        //  $('body').append('<div id="custom-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0, 0, 0, 0.6); z-index:999;">Loading...</div>');
        //  $('body').append('<div id="custom-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0, 0, 0, 0.6); z-index:999; display:flex; justify-content:center; align-items:center; color:white; font-size:20px; font-weight:bold;">Loading...</div>');
        // $('body').append('<div id="custom-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0, 0, 0, 0.6); z-index:999; justify-content:center; align-items:center; color:white; font-size:20px; font-weight:bold;">Loading...</div>');
        $('body').append(
            '<div id="custom-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0, 0, 0, 0.6); z-index:999; text-align:center; line-height:100vh; color:white; font-size:20px; font-weight:bold;">Loading...</div>'
        );

        frm.set_query('customer', function () {
            return {
                filters: [
                    ['Customer', 'customer_status', '=', 'Active'],
                    ['Customer', 'disabled', '=', 0]
                ]
            };
        });

        frm.set_query('product_catalog', function () {
            return {
                filters: [['Catalog', 'status', '=', 'Product']]
            };
        });
        frm.set_query('product_scope', function () {
            return {
                filters: [
                    ['Catalog', 'status', '=', 'Product Scope'],
                    ['Catalog', 'parent_catalog', '=', frm.doc.product_catalog]
                ]
            };
        });
        frm.set_query('product_scope', 'kom_sitelist', () => {
            return {
                filters: [
                    ['status', '=', 'Product Scope'],
                    ['parent_catalog', '=', frm.doc.product_catalog]
                ]
            };
        });

        frm.set_query('class_of_service', function () {
            return {
                filters: [['Class of Service', 'is_active', '=', 1]]
            };
        });
        frm.set_query('catalog_customer', function () {
            return {
                filters: [
                    ['Catalog', 'status', '=', 'Customer Contract'],
                    ['Catalog', 'customer', '=', cur_frm.doc.customer],
                    ['Catalog', 'parent_catalog', '=', cur_frm.doc.product_scope],
                    ['Catalog', 'class_of_service', '=', cur_frm.doc.class_of_service]
                ]
            };
        });
        frm.set_query('contract', function () {
            return {
                filters: [
                    ['Contract', 'party_name', '=', cur_frm.doc.customer],
                    ['Contract', 'product_scope', '=', cur_frm.doc.product_scope]
                ]
            };
        });
        frm.set_query('sales_program', function () {
            return {
                filters: [['Sales Program', 'customer', '=', cur_frm.doc.customer]]
            };
        });
        if (frm.doc.product_catalog == 'Tower Lease Reseller') {
            cur_frm.set_query('tower_id', 'collo_list', function (doc, cdt, cdn) {
                return {
                    filters: [['Asset', 'tower_owner', '!=', 'MITRATEL']]
                };
            });
        } else if (
            frm.doc.product_catalog == 'Tower Lease Collocation' ||
            frm.doc.product_scope == 'Tower Acquisition Collocation' ||
            frm.doc.product_scope == 'B2S Permanenisasi'
        ) {
            cur_frm.set_query('tower_id', 'collo_list', function (doc, cdt, cdn) {
                return {
                    filters: [['Asset', 'tower_owner', 'in', ['MITRATEL', 'TELKOM']]]
                };
            });
        }

        cur_frm.set_query('site_id_reference', 'kom_sitelist', function (doc, cdt, cdn) {
            var d = locals[cdt][cdn];
            // 			if (d.check_site_on == 'Mitratel') {
            // 				return {
            // 					filters: [
            // 						['Site', 'tower_owner', '=', 'MITRATEL'],
            // 						['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]
            // 					]
            // 				};
            // 			} else {
            // 				return {
            // 					filters: [
            // 						['Site', 'tower_owner', '!=', 'MITRATEL'],
            // 						['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]
            // 					]
            // 				};
            // 			}

            if (d.check_site_owner == 'MITRATEL') {
                return {
                    filters: [
                        ['Site', 'tower_owner', '=', 'MITRATEL'],
                        ['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]
                    ]
                };
            } else {
                return {
                    filters: [
                        ['Site', 'tower_owner', '!=', 'MITRATEL'],
                        ['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]
                    ]
                };
            }
        });
        cur_frm.set_query('site_id_target', 'kom_sitelist', function (doc, cdt, cdn) {
            // 			return {
            // 				filters: [['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]]
            // 			};
            var d = locals[cdt][cdn];
            if (d.check_site_on == 'Mitratel') {
                return {
                    filters: [
                        ['Site', 'tower_owner', '=', 'MITRATEL'],
                        ['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]
                    ]
                };
            } else {
                return {
                    filters: [
                        ['Site', 'tower_owner', '!=', 'MITRATEL'],
                        ['Site', 'workflow_state', 'in', ['DEVL', 'INOP']]
                    ]
                };
            }
        });

        frm.fields_dict['kom_sitelist'].grid.get_field('item_variant').get_query = function (
            doc,
            cdt,
            cdn
        ) {
            let d = locals[cdt][cdn];
            let item = [];
            // console.log(frm.item_variants_filter_child?[d.parentfield])
            if (frm.item_variants_filter_child[d.parentfield]) {
                console.log('Item Variant', frm.item_variants_filter_child);
                item = frm.item_variants_filter_child[d.parentfield][d.name];
            }

            console.log('hfhjjg', item);
            if (item.length === 0) {
                frappe.throw(
                    __(
                        'Item Variant not available, please complete the contract, location or site, and tower height. Or check the pricing schema on contract.'
                    )
                );
            }

            return {
                filters: [['name', 'in', item]]
            };
        };

        //BISA NIH PAKE INI
        frm.fields_dict['sitelist_item'].grid.get_field('item_variant').get_query = function (
            doc,
            cdt,
            cdn
        ) {
            let d = locals[cdt][cdn];
            let item = [];
            // console.log(d);
            // console.log(doc);
            // console.log(frm.item_variants_filter_child?[d.parentfield])
            if (frm.item_variants_filter_child[d.parentfield]) {
                console.log('Item Variant', frm.item_variants_filter_child);
                item = frm.item_variants_filter_child[d.parentfield][d.name];
            }

            return {
                filters: [['name', 'in', item]]
            };
        };

        frm.fields_dict['collo_list'].grid.get_field('item_variant').get_query = function (
            doc,
            cdt,
            cdn
        ) {
            let d = locals[cdt][cdn];
            let item = [];
            console.log(d);
            console.log(doc);
            if (frm.item_variants_filter_child[d.parentfield]) {
                item = frm.item_variants_filter_child[d.parentfield][d.name];
            }

            return {
                filters: [['name', 'in', item]]
            };
        };

        frm.fields_dict['solution_list'].grid.get_field('item_variant').get_query = function (
            doc,
            cdt,
            cdn
        ) {
            let d = locals[cdt][cdn];
            let item = [];
            console.log(d);
            console.log(doc);
            if (frm.item_variants_filter_child[d.parentfield]) {
                item = frm.item_variants_filter_child[d.parentfield][d.name];
            }

            return {
                filters: [['name', 'in', item]]
            };
        };

        frm.fields_dict['relocation_list'].grid.get_field('item_variant').get_query = function (
            doc,
            cdt,
            cdn
        ) {
            let d = locals[cdt][cdn];
            let item = [];
            console.log(d);
            console.log(doc);
            if (frm.item_variants_filter_child[d.parentfield]) {
                item = frm.item_variants_filter_child[d.parentfield][d.name];
            }

            return {
                filters: [['name', 'in', item]]
            };
        };

        frm.fields_dict['additional_services_list'].grid.get_field('item_variant').get_query =
            function (doc, cdt, cdn) {
                let d = locals[cdt][cdn];
                let item = [];
                console.log(d);
                console.log(doc);
                if (frm.item_variants_filter_child[d.parentfield]) {
                    item = frm.item_variants_filter_child[d.parentfield][d.name];
                }

                return {
                    filters: [['name', 'in', item]]
                };
            };
        // 		frm.set_query("item_variant", "sitelist_item", function(doc,cdt,cdn) {
        // 	        var d = locals [cdt][cdn];
        // 		    return {
        // 			    filters: [
        // 				    ["Item", "contract_ref", "=", cur_frm.doc.contract],
        // 				    // ["Item", "name", "in", item_variant_name]
        // 			]
        // 			}
        // // 		});
        // 		frm.set_query("item_variant", "collo_list", function(doc,cdt,cdn) {
        // 	         var d = locals [cdt][cdn];
        // 		    return {
        // 			    filters: [
        // 				    ["Item", "contract_ref", "=", cur_frm.doc.contract]
        // 			]
        // 			}
        // 		});
        // 		frm.set_query("item_variant", "solution_list", function(doc,cdt,cdn) {
        // 	         var d = locals [cdt][cdn];
        // 		    return {
        // 			    filters: [
        // 				    ["Item", "contract_ref", "=", cur_frm.doc.contract]
        // 			]
        // 			}
        // 		});
        // 		frm.set_query("item_variant", "relocation_list", function(doc,cdt,cdn) {
        // 	         var d = locals [cdt][cdn];
        // 		    return {
        // 			    filters: [
        // 				    ["Item", "contract_ref", "=", cur_frm.doc.contract]
        // 			]
        // 			}
        // 		});
        // 		frm.set_query("item_variant", "additional_services_list", function(doc,cdt,cdn) {
        // 	         var d = locals [cdt][cdn];
        // 		    return {
        // 			    filters: [
        // 				    ["Item", "contract_ref", "=", cur_frm.doc.contract]
        // 			]
        // 			}
        // 		});
        frm.set_query('item_variant', 'other_services_list', function (doc, cdt, cdn) {
            var d = locals[cdt][cdn];
            return {
                filters: [['Item', 'contract_ref', '=', cur_frm.doc.contract]]
            };
        });

        if (frm.doc.attach_excel) {
            frm.set_df_property('reload_preview', 'read_only', 0);
        } else {
            frm.set_df_property('reload_preview', 'read_only', 1);
        }
    },

    quotation: function (frm, cdt, cdn) {
        if (cur_frm.doc.kom_input !== 'Quotation') {
            cur_frm.set_value('kom_input', 'Quotation');
        }

        cur_frm.clear_table('sitelist_item');

        frappe.call({
            method: 'frappe.client.get',
            async: false,
            args: {
                doctype: 'Quotation',
                name: frm.doc.quotation
            },
            callback: function (response) {
                if (response.message) {
                    console.log(response.message);

                    if (response.message.site_roll_out) {
                        $.each(response.message.site_roll_out, function (i, row) {
                            var child_add_rollout = cur_frm.add_child('sitelist_item');
                            child_add_rollout.latlong = row.circle_lat_long;
                            child_add_rollout.district_or_city = row.district_or_city;
                            child_add_rollout.max_radius_m = row.radius;
                            child_add_rollout.tower_height_m = row.tower_height;
                        });
                    }
                }
            }
        });
        frm.refresh_field('sitelist_item');
    },
    product_catalog: function (frm, cdt, cdn) {
        cur_frm.set_value('product_scope', '');
        cur_frm.set_value('catalog_customer', '');
        cur_frm.set_value('contract', '');
        cur_frm.clear_table('sitelist_item');
        frm.refresh_field('sitelist_item');
        cur_frm.clear_table('collo_list');
        frm.refresh_field('collo_list');
        cur_frm.clear_table('solution_list');
        frm.refresh_field('solution_list');
        cur_frm.clear_table('relocation_list');
        frm.refresh_field('relocation_list');
        cur_frm.clear_table('additional_services_list');
        frm.refresh_field('additional_services_list');
        cur_frm.clear_table('other_services_list');
        frm.refresh_field('other_services_list');
        cur_frm.clear_table('kom_sitelist');
        frm.refresh_field('kom_sitelist');

        //testing
        //     let obj = {tenant_id:"YYK-06-071-NA-TS-01"}
        // addChild(frm, "additional_services_list", obj)
        //testing remove later

        // ---- new kom child script
        if (frm.doc.product_catalog) {
            frm.set_query('product_scope', 'kom_sitelist', () => {
                return {
                    filters: [
                        ['status', '=', 'Product Scope'],
                        ['parent_catalog', '=', frm.doc.product_catalog]
                    ]
                };
            });
            cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
                grid_row.docfields.forEach((df) => {
                    if (df.fieldname == 'product_scope') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'product_scope', '');
                    }
                    if (df.fieldname == 'contract') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'contract', '');
                    }
                    if (df.fieldname == 'item_variant') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'item_variant', '');
                    }
                });
            });
        } else {
            cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
                grid_row.docfields.forEach((df) => {
                    if (df.fieldname == 'product_scope') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'product_scope', '');
                    }
                    if (df.fieldname == 'contract') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'contract', '');
                    }
                    if (df.fieldname == 'item_variant') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'item_variant', '');
                    }
                });
            });
        }

        if (frm.doc.product_catalog == 'Tower Lease Additional Services') {
            frm.set_query('tenant_id_reference', 'additional_services_list', function (doc, cdt, cdn) {
                var d = locals[cdt][cdn];
                return {
                    filters: [['Tenant', 'asset_name', '=', d.tower_id_reference]]
                };
            });
        }
        if (frm.doc.product_catalog == 'Tower Lease Reseller') {
            cur_frm.set_query('tower_id', 'collo_list', function (doc, cdt, cdn) {
                var d = locals[cdt][cdn];
                return {
                    filters: [['Asset', 'tower_owner', '!=', 'MITRATEL']]
                };
            });
        } else if (
            frm.doc.product_catalog == 'Tower Lease Collocation' ||
            frm.doc.product_scope == 'B2S Permanesisasi'
        ) {
            cur_frm.set_query('tower_id', 'collo_list', function (doc, cdt, cdn) {
                var d = locals[cdt][cdn];
                return {
                    filters: [['Asset', 'tower_owner', 'in', ['MITRATEL', 'TELKOM']]]
                };
            });
        }
    },
    product_scope: function (frm, cdt, cdn) {
        cur_frm.set_value('catalog_customer', '');
        // console.log("PS 3 line 1571")
    },
    catalog_customer: function (frm, cdt, cdn) { },
    // rules display field update_to_ap
    refresh: function (frm) {
        let arr = ['Waiting Update E-CAF', 'Sales Manager Review', 'Submitted', 'Cancelled'];
        let state = frm.doc.workflow_state;
        if (arr.includes(state)) {
            frm.set_df_property('update_to_ap', 'hidden', 0);
        } else {
            frm.set_df_property('update_to_ap', 'hidden', 1);
        }

        if (frm.doc.workflow_state != 'Waiting Update E-CAF') {
            frm.set_df_property('update_to_ap', 'read_only', 1);
        } else {
            frm.set_df_property('update_to_ap', 'read_only', 0);
        }

        // TECH-1235 - Tandigital
        if (frm.doc.template_update_device == null) {
            $(`button[data-fieldname='download_template']`).remove();
        }
    }


});

frappe.ui.form.on('Kick Off Meeting', {
    region: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        frm.set_query('catalog_height_area', 'sitelist_item', function (doc, cdt, cdn) {
            var d = locals[cdt][cdn];
            return {
                filters: [['Item Price', 'territory', '=', d.region]]
            };
        });
    },

    customer: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        if (d.customer || d.customer === undefined) {
            cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
                grid_row.docfields.forEach((df) => {
                    if (df.fieldname == 'contract') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'contract', '');
                    }
                    if (df.fieldname == 'contract') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'contract', '');
                    }
                    if (df.fieldname == 'item_variant') {
                        frappe.model.set_value('KOM Child Table', grid_row.doc.name, 'item_variant', '');
                    }
                    if (df.fieldname == 'site_id_reference') {
                        frappe.model.set_value(
                            'KOM Child Table',
                            grid_row.doc.name,
                            'site_id_reference',
                            ''
                        );
                    }
                });
            });
        }
    }

});


frappe.ui.form.on('KOM Child Table', {
    form_render: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
            frm.set_query('contract', 'kom_sitelist', (doc, cdt, cdn) => {
                console.log('setcontract frm rendre');
                return {
                    filters: [
                        ['party_name', '=', frm.doc.customer],
                        ['product_scope', '=', grid_row.doc.product_scope]
                    ]
                };
            });

        });
    },
    kom_sitelist_add: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        frm.set_query('product_scope', 'kom_sitelist', () => {
            return {
                filters: [
                    ['status', '=', 'Product Scope'],
                    ['parent_catalog', '=', frm.doc.product_catalog]
                ]
            };
        });

        cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
            frm.set_query('contract', 'kom_sitelist', (doc, cdt, cdn) => {
                return {
                    filters: [
                        ['party_name', '=', frm.doc.customer],
                        ['product_scope', '=', grid_row.doc.product_scope]
                    ]
                };
            });
        });

        // frappe.model.set_value(d.doctype, d.name, "product_scope", "Add Equipment Paid (Macro)")
    },
    product_scope: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        console.log('PS 1 line 2701');
        frm.set_query("contract", "kom_sitelist", (doc, cdt, cdn) => {
            return {
                filters: [
                    ["party_name", "=", frm.doc.customer],
                    ["product_scope", "=", d.product_scope],
                ],
            };
        });

    },
    contract: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];

        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');

    },
    duration_rfc: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        let duration_rfc = d.duration_rfc;
        let today = new Date();
        let target_rfc = new Date(today.setDate(today.getDate() + duration_rfc));
        target_rfc = target_rfc.toISOString().slice(0, 10);
        frappe.model.set_value(d.doctype, d.name, 'target_rfc', target_rfc);
    },
    duration_rfi: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        let duration_rfi = d.duration_rfi;
        let today = new Date();
        let target_rfi = new Date(today.setDate(today.getDate() + duration_rfi));
        target_rfi = target_rfi.toISOString().slice(0, 10);
        frappe.model.set_value(d.doctype, d.name, 'target_rfi', target_rfi);
    },
    item_variant: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        function getClassDesc(cos) {
            frappe.db
                .get_doc('Class of Service', cos)
                .then((response) => {
                    console.log('COS', response);
                    if (response.description) {
                        frappe.model.set_value(d.doctype, d.name, 'cos_desc', response.description);
                    }
                })
                .catch((err) => console.error(err));
        }
        if (d.item_variant) {
            frappe.db
                .get_doc('Item', d.item_variant)
                .then((response) => {
                    let cos;
                    response.attributes.forEach((attr) => {
                        if (attr.attribute == 'Class of Service') {
                            cos = attr.attribute_value;
                            frappe.model.set_value(d.doctype, d.name, 'cos_level', cos);
                        }
                    });

                    getClassDesc(cos);
                })
                .catch((err) => console.error(err));
        }
    },

    site_id_reference: async function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];

        let multiple_tenant = false

        await frappe.db.get_value('Customer', frm.doc.customer, ['allow_multiple_tenant'])
            .then(r => {
                let values = r.message;
                console.log("Customer allow value:", values.allow_multiple_tenant)
                if (values.allow_multiple_tenant) {
                    multiple_tenant = true
                }
                console.log("allow multiple tenant 1", multiple_tenant)
            })
        console.log("allow multiple tenant 2", multiple_tenant)

        if (d.site_id_reference && d.site_id_reference !== '') {

            await checkTowerOwnerSite(d.site_id_reference)
            if (d.change_site_loc === 'No') {
                let isSiteOk = await checkSiteStatusPromise(d.site_id_reference);
                // console.log('CASE 1: change_site_loc NO', isSiteOk);
                if (isSiteOk) {
                    if (d.check_duplicate_tenant === 'Yes') {
                        // console.log('CASE 1: checkDuplicate 1.1', multiple_tenant);
                        if (!multiple_tenant) {
                            // console.log('CASE 1: checkDuplicate 1.1.1');
                            await checkDuplicateTenantNewSite(d.site_id_reference, frm.doc.customer);
                        }
                        else { //start : SDP #3384
                            //should handle auto site detail for allow multiple tenant from customer
                            // console.log('CASE 1: checkDuplicate 1.1.2: Multiple tenant TRUE', multiple_tenant);
                            handleNumberOfTenant(d.site_id_reference);
                            handleSiteDetail(d.site_id_reference);
                            autofillTpName(d.site_id_reference);
                        } //end: SDP #3384 by Hamid

                    } else {
                        // console.log('CASE 1: checkDuplicate 1.2');
                        if (d.new_tenant_info == "No") {
                            if (multiple_tenant) {
                                // If multiple tenants are allowed, handle tenant ID
                                handleTenantId(d.site_id_reference);
                            } else {
                                handleTenantId(d.site_id_reference);
                            }
                        } else if (d.new_tenant_info == "Yes") {
                            handleNumberOfTenant(d.site_id_reference);
                            handleSiteDetail(d.site_id_reference);
                            autofillTpName(d.site_id_reference);
                        }
                    }
                }
            } else {
                //   console.log('CASE 2: change_site_loc NO', isSiteOk);
                if (
                    (d.check_duplicate_tenant === 'Yes' && d.change_site_loc == 'Target New Site') ||
                    (d.check_duplicate_tenant === 'Yes' && d.change_site_loc == 'No')
                ) {
                    if (!multiple_tenant) {
                        // console.log('CASE 2: checkDuplicate');
                        await checkDuplicateTenantNewSite(d.site_id_reference, frm.doc.customer);
                    }
                    else { //start : SDP #3384
                        //should handle auto site detail for allow multiple tenant from customer
                        // console.log('CASE 1: checkDuplicate 1.1.2: Multiple tenant TRUE', multiple_tenant);
                        handleNumberOfTenant(d.site_id_reference);
                        handleSiteDetail(d.site_id_reference);
                        autofillTpName(d.site_id_reference);
                    } //end: SDP #3384 by Hamid 
                } else {
                    await handleTenantId(d.site_id_reference);
                }
            }

            console.log('after promises');
            // Handle clearing of fields
            // await Promise.allSettled([
            // 	d.tenant_id_reference
            // 		? autofillSiteDetails(d.tenant_id_reference)
            // 		: clearSiteDetails(d.tenant_id_reference),
            // 	checkTowerOwnerSite(d.site_id_reference)
            // ]);
        } else {
            // Set values if site_id_reference is empty
            frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
            frappe.model.set_value(d.doctype, d.name, 'tower_height', '');
            frappe.model.set_value(d.doctype, d.name, 'height_request', '');
            frappe.model.set_value(d.doctype, d.name, 'latlong', '');
            frappe.model.set_value(d.doctype, d.name, 'current_tenant', '');
            frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
            frappe.model.set_value(d.doctype, d.name, 'site_id_tenant', '');
            frappe.model.set_value(d.doctype, d.name, 'site_name_tenant', '');
        }

        function checkTowerOwnerSite(site_id) {
            console.log('checkTowerOwnerSite');
            var site = frappe.db
                .get_list('Site', {
                    fields: ['name', 'tower_owner'],
                    filters: [['name', '=', site_id]],
                    limit: 100
                })
                .then((records) => {
                    if (records.length > 0) {
                        // 		if (d.check_site_on == 'Mitratel' && records[0].tower_owner != 'MITRATEL') {
                        // 			console.log('clearing and throwing');
                        // 			frappe.model.set_value(d.doctype, d.name, 'site_id_reference', '');
                        // 			frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
                        // 			frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
                        // 			frappe.throw(__('Tower Owner Must be MITRATEL'));
                        // 		}

                        // 		if (d.check_site_on != 'Mitratel' && records[0].tower_owner == 'MITRATEL') {
                        // 			frappe.model.set_value(d.doctype, d.name, 'site_id_reference', '');
                        // 			frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
                        // 			frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
                        // 			frappe.throw(__("Tower Owner Can't be MITRATEL"));
                        // 		}

                        if (d.check_site_owner == 'MITRATEL' && records[0].tower_owner != 'MITRATEL') {
                            console.log('clearing and throwing');
                            frappe.model.set_value(d.doctype, d.name, 'site_id_reference', '');
                            frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
                            frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
                            frappe.throw(__('Tower Owner Must be MITRATEL'));
                        }

                        if (d.check_site_owner != 'MITRATEL' && records[0].tower_owner == 'MITRATEL') {
                            frappe.model.set_value(d.doctype, d.name, 'site_id_reference', '');
                            frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
                            frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
                            frappe.throw(__("Tower Owner Can't be MITRATEL"));
                        }
                    }
                })
                .catch((err) => console.error(err));
        }

        // JIRA number 2.
        function clearSiteDetails(tenant_id_reference) {
            console.log('clearSiteDetails');
            if (d.tenant_options == 'Existing Tenant Modification' && tenant_id_reference == null) {
                try {
                    let site_id_ref = d.site_id_reference;
                    // resetField()
                    frappe.model.set_value(d.doctype, d.name, 'site_id_reference', '');
                    frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
                    frappe.model.set_value(d.doctype, d.name, 'tower_height', '');
                    frappe.model.set_value(d.doctype, d.name, 'height_request', '');
                    frappe.model.set_value(d.doctype, d.name, 'latlong', '');
                    frappe.model.set_value(d.doctype, d.name, 'current_tenant', '');
                    frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
                    frappe.throw(
                        __(
                            `There's no tenant listed on Site ${site_id_ref}. Please use another Site ID or contact the ticketing support.`
                        )
                    );
                } catch (err) {
                    console.log(err);
                }
            }
        }

        async function autofillSiteDetails(tenant_id_reference) {
            if (
                d.tenant_options == 'Existing Tenant Modification' &&
                tenant_id_reference != null &&
                tenant_id_reference != ''
            ) {
                console.log('Fetching tenant site id tenant site name tenant');
                await frappe.db
                    .get_list('Tenant', {
                        fields: ['name', 'workflow_state', 'site_id_tenant', 'site_name_tenant'],
                        filters: [['name', '=', tenant_id_reference]],
                        limit: 100
                    })
                    .then(async (records) => {
                        if (records.length > 0 && (d.tenant_options == 'Existing Tenant Modification' || d.tenant_options == 'Existing Tenant Relocation')) {
                            await frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'tenant_id_reference',
                                tenant_id_reference
                            );
                            await frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'site_id_tenant',
                                records[0].site_id_tenant
                            );
                            await frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'site_name_tenant',
                                records[0].site_name_tenant
                            );
                        }
                    });
            }
        }

        // if site_id_reference empty reset tp_name and site_name
        cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
            grid_row.docfields.forEach((df) => {
                if (!d.site_id_reference) {
                    d.tp_name = '';
                    d.site_name = '';
                }
                grid_row.refresh();
            });
        });

        function autofillTpName(site_id_reference) {
            console.log('autofillTpName');
            // autofill tp_name on specific logic
            if (
                d.input_order == 'Existing Site' &&
                (d.change_site_loc == 'No' || d.change_site_loc == 'Target New Site') &&
                (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
            ) {
                frappe.db
                    .get_list('Site', {
                        fields: ['site_owner'],
                        filters: [['name', '=', site_id_reference]],
                        limit: 100
                    })
                    .then((records) => {
                        if (records.length > 0) {
                            if (records[0].site_owner) {
                                frappe.model.set_value(d.doctype, d.name, 'tp_name', records[0].site_owner);
                            }
                        }
                    })
                    .catch((err) => console.error(err));
            }
        }

        // check site status with promise
        function checkSiteStatusPromise(site_id_reference) {
            console.log('checkSiteStatusPromise');
            return new Promise((resolve, reject) => {
                frappe.db
                    .get_list('Site', {
                        fields: ['name', 'workflow_state', 'tower_owner'],
                        filters: [['name', '=', site_id_reference]],
                        limit: 100
                    })
                    .then((records) => {
                        console.log(records, 'checkSiteStatus');
                        if (records.length > 0) {
                            if (
                                records[0].workflow_state == 'DROP' ||
                                records[0].workflow_state == 'DISP'
                            ) {
                                resetField();
                                frappe.msgprint({
                                    title: 'Warning',
                                    message:
                                        'Site ID ' +
                                        '<b>' +
                                        site_id_reference +
                                        '</b>' +
                                        ' already in status of ' +
                                        '<b>' +
                                        records[0].workflow_state +
                                        '</b>' +
                                        '. Please use another Site/Tower ID or contact the ticketing support.',
                                    indicator: 'red'
                                });
                                reject();
                            } else {
                                resolve(true);
                            }
                        } else {
                            frappe.hide_msgprint();
                            frappe.msgprint({
                                title: 'Warning',
                                message:
                                    'Site ID ' +
                                    '<b>' +
                                    site_id_reference +
                                    '</b>' +
                                    ' not found. Please use another Site ID or contact the ticketing support.',
                                indicator: 'red'
                            });
                        }
                    });
            });
        }

        function isHasDEVLorINOP(arr) {
            return arr.some(
                (item) => item.workflow_state === 'DEVL' || item.workflow_state === 'INOP'
            );
        }

        function checkDuplicateTenantNewSite(siteId, customer) {
            console.log('checkDuplicateTenantNewSite');
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Tenant',
                    filters: [
                        ['site_id', '=', siteId],
                        ['customer', '=', customer]
                    ],
                    fields: ['workflow_state']
                },
                callback: (response) => {
                    // If it has Tenant,check if it's DEVL/INOP => show alert, if it is not continue autofill site
                    // If it has no Tenant autofill site
                    if (response.message.length > 0) {
                        if (isHasDEVLorINOP(response.message)) {
                            resetField();
                            frappe.hide_msgprint();
                            frappe.msgprint(
                                'Tenant for ' +
                                '<b>' +
                                customer +
                                '</b>' +
                                ' at SITE ID ' +
                                siteId +
                                '<b>' +
                                ' already exist.' +
                                '</b>' +
                                ' Please consider to change catalog into Additional Service or choose another tenant customer'
                            );
                        } else {
                            //Fix bug or logic that if tenant options is New Tenant then skip handle tenant (this for case like collo or reseller) by Hamid

                            if (d.tenant_options != 'New Tenant') {
                                handleTenantId(d.site_id_reference);
                            }
                            handleNumberOfTenant(d.site_id_reference);
                            handleSiteDetail(d.site_id_reference);
                            autofillTpName(d.site_id_reference);
                        }
                    } else {
                        //Fix bug or logic that if tenant options is New Tenant then skip handle tenant (this for case like collo or reseller) by Hamid

                        if (d.tenant_options != 'New Tenant') {
                            handleTenantId(d.site_id_reference);
                        }
                        handleNumberOfTenant(d.site_id_reference);
                        handleSiteDetail(d.site_id_reference);
                        autofillTpName(d.site_id_reference);
                    }
                }
            });
        }

        async function handleTenantId(siteId) {
            console.log('handleTenantId');
            await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Tenant',
                    filters: [
                        ['site_id', '=', siteId],
                        ['customer', '=', frm.doc.customer]
                        // ['workflow_state', 'in', ['DEVL', 'INOP']]
                    ],
                    fields: ['name']
                },
                callback: async (response) => {
                    console.log(response, 'res tenant id');
                    if (response.message.length) {
                        let tenantId = response.message[0].name;
                        await checkTenantIdReference(tenantId);
                    } else {
                        resetField();
                        frappe.hide_msgprint();
                        frappe.msgprint({
                            title: 'Warning',
                            message: `There's no tenant listed on Site ${siteId}. Please use another Site ID or contact the ticketing support.`,
                            indicator: 'red'
                        });
                    }
                }
            });
        }
        function handleSiteDetail(siteId) {
            console.log(d.site_id_reference, 'handleSiteDetail');
            // get site detail: tower_height, latlong, city_or_regency,province, region, area, site_address, district
            frappe.db
                .get_list('Site', {
                    fields: ['*'],
                    filters: [['name', '=', siteId]],
                    limit: 100
                })

                .then((records) => {
                    if (records.length > 0) {
                        console.log(records, 'getsite');
                        if (records[0].tower_height) {
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'tower_height',
                                records[0].tower_height
                            );
                        }

                        if (d.input_order == 'Existing Site' && d.change_site_loc != 'Target New Site') {
                            if (records[0].lat_long_actual) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'latlong',
                                    records[0].lat_long_actual
                                );
                            }

                            if (records[0].district_or_city_1) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'city_or_regency',
                                    records[0].district_or_city_1
                                );
                            }

                            if (records[0].province) {
                                frappe.model.set_value(d.doctype, d.name, 'province', records[0].province);
                            }

                            if (records[0].region) {
                                frappe.model.set_value(d.doctype, d.name, 'region', records[0].region);
                            }

                            if (records[0].area) {
                                frappe.model.set_value(d.doctype, d.name, 'area', records[0].area);
                            }

                            if (records[0].site_address) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_address',
                                    records[0].site_address
                                );
                            }
                            if (records[0].district) {
                                frappe.model.set_value(d.doctype, d.name, 'district', records[0].district);
                            }

                            if (records[0].site_name) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_name',
                                    records[0].site_name
                                );
                            }
                            if (records[0].tower_type) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'tower_type',
                                    records[0].tower_type
                                );
                            }
                            if (records[0].site_owner) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_owner',
                                    records[0].site_owner
                                );
                            }
                        }

                        // 	Case Import First
                        if (!d.product_scope) {
                            if (records[0].lat_long_actual) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'latlong',
                                    records[0].lat_long_actual
                                );
                            }

                            if (records[0].district_or_city_1) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'city_or_regency',
                                    records[0].district_or_city_1
                                );
                            }

                            if (records[0].province) {
                                frappe.model.set_value(d.doctype, d.name, 'province', records[0].province);
                            }

                            if (records[0].region) {
                                frappe.model.set_value(d.doctype, d.name, 'region', records[0].region);
                            }

                            if (records[0].area) {
                                frappe.model.set_value(d.doctype, d.name, 'area', records[0].area);
                            }

                            if (records[0].site_address) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_address',
                                    records[0].site_address
                                );
                            }
                            if (records[0].district) {
                                frappe.model.set_value(d.doctype, d.name, 'district', records[0].district);
                            }
                        }
                    }
                })
                .catch((err) => console.error(err));
        }
        function handleProjectId(tenantId) {
            console.log('handleProjectId');
            frappe.db
                .get_list('Tenant', {
                    fields: ['project_reference'],
                    filters: [['name', '=', tenantId]],
                    limit: 100
                })
                .then((records) => {
                    if (records.length > 0) {
                        if (records[0].project_reference) {
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'project_id_reference',
                                records.project_reference
                            );
                        }
                    }
                })
                .catch((err) => console.error(err));
        }
        function handleNumberOfTenant(siteId) {
            console.log('handleNumberOfTenant');
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Tenant',
                    filters: [
                        ['site_id', '=', siteId],
                        ['workflow_state', 'in', ['DEVL', 'INOP']]
                    ],
                    fields: ['*']
                },
                callback: (response) => {
                    if (response.message) {
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'current_tenant',
                            response.message.length
                        );
                    }
                }
            });
        }
        function resetField() {
            console.log('resetField');
            frappe.model.set_value(d.doctype, d.name, 'site_id_reference', '');
            frappe.model.set_value(d.doctype, d.name, 'tenant_id_reference', '');
            frappe.model.set_value(d.doctype, d.name, 'tower_height', '');
            frappe.model.set_value(d.doctype, d.name, 'height_request', '');
            frappe.model.set_value(d.doctype, d.name, 'latlong', '');
            frappe.model.set_value(d.doctype, d.name, 'current_tenant', '');
            frappe.model.set_value(d.doctype, d.name, 'project_id_reference', '');
        }
        async function checkTenantIdReference(tenant_id_reference) {
            console.log('checkTenantIdReference');
            await frappe.db
                .get_list('Tenant', {
                    //Fix auto fecth site id tenant and site name tenant by Hamid
                    fields: ['name', 'workflow_state', 'site_id_tenant', 'site_name_tenant'],
                    filters: [
                        ['name', '=', tenant_id_reference],
                        ['workflow_state', 'in', ["INOP", 'DEVL']]
                    ],
                    limit: 100
                })
                .then(async (records) => {
                    console.log(records, 'checkTenantIdReference');
                    if (records.length > 0 && d.tenant_options == 'Existing Tenant Modification') {
                        if (records[0].workflow_state == 'DROP' || records[0].workflow_state == 'DISP') {
                            resetField();
                            frappe.hide_msgprint();
                            frappe.msgprint({
                                title: 'Warning',
                                message:
                                    'TENANT ID ' +
                                    '<b>' +
                                    tenant_id_reference +
                                    '</b>' +
                                    ' already in status of ' +
                                    '<b>' +
                                    records[0].workflow_state +
                                    '</b>' +
                                    '. Please use another Tenant ID or contact the ticketing support.',
                                indicator: 'red'
                            });
                        } else {
                            handleNumberOfTenant(d.site_id_reference);
                            handleSiteDetail(d.site_id_reference);
                            autofillTpName(d.site_id_reference);
                            handleProjectId(tenant_id_reference);
                        }
                        await frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'tenant_id_reference',
                            tenant_id_reference
                        );
                        await frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'site_id_tenant',
                            records[0].site_id_tenant
                        );
                        await frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'site_name_tenant',
                            records[0].site_name_tenant
                        );

                    } else if (records.length > 0 && d.tenant_options == 'Existing Tenant Relocation') {
                        await frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'tenant_id_reference',
                            tenant_id_reference
                        );
                        handleProjectId(tenant_id_reference);;
                        if (d.change_site_loc == "Target Existing Site") {
                            console.log("inside Target exisiting site")
                            handleNumberOfTenant(d.site_id_target);
                            handleSiteDetail(d.site_id_target);
                            autofillTpName(d.site_id_target)
                        }
                        else {
                            autofillTpName(d.site_id_reference);
                        }


                    } else {
                        handleNumberOfTenant(d.site_id_reference);
                        handleSiteDetail(d.site_id_reference);
                        autofillTpName(d.site_id_reference);
                        handleProjectId(tenant_id_reference);
                    }
                });
        }
    },
    site_id_target: async function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];

        if (d.site_id_target) {
            await checkTowerOwner(d.site_id_target);
            if (d.change_site_loc === 'Target Existing Site') {
                const isSiteOk = await checkSiteStatusPromise(d.site_id_target);
                if (isSiteOk) {
                    if (d.check_duplicate_tenant === 'Yes') {
                        checkSiteIdTarget(d.site_id_target, frm.doc.customer);
                    }
                }
            } else if (
                d.input_order == 'Existing Site' &&
                d.change_site_loc == 'Target Existing Site' &&
                (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')

            ) {
                frappe.db
                    .get_doc('Site', d.site_id_reference)
                    .then((response) => {
                        if (response.site_owner) {
                            frappe.model.set_value(d.doctype, d.name, 'tp_name', response.site_owner);
                        }
                    })
                    .catch((err) => console.error(err));
            }
        }

        function handleSiteDetail(siteId) {
            console.log(d.site_id_reference, 'handleSiteDetail');
            // get site detail: tower_height, latlong, city_or_regency,province, region, area, site_address, district
            frappe.db
                .get_list('Site', {
                    fields: ['*'],
                    filters: [['name', '=', siteId]],
                    limit: 100
                })

                .then((records) => {
                    if (records.length > 0) {
                        console.log(records, 'getsite');
                        if (records[0].tower_height) {
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'tower_height',
                                records[0].tower_height
                            );
                        }

                        if (d.input_order == 'Existing Site' && d.change_site_loc != 'Target New Site') {
                            if (records[0].lat_long_actual) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'latlong',
                                    records[0].lat_long_actual
                                );
                            }

                            if (records[0].district_or_city_1) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'city_or_regency',
                                    records[0].district_or_city_1
                                );
                            }

                            if (records[0].province) {
                                frappe.model.set_value(d.doctype, d.name, 'province', records[0].province);
                            }

                            if (records[0].region) {
                                frappe.model.set_value(d.doctype, d.name, 'region', records[0].region);
                            }

                            if (records[0].area) {
                                frappe.model.set_value(d.doctype, d.name, 'area', records[0].area);
                            }

                            if (records[0].site_address) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_address',
                                    records[0].site_address
                                );
                            }
                            if (records[0].district) {
                                frappe.model.set_value(d.doctype, d.name, 'district', records[0].district);
                            }

                            if (records[0].site_name) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_name',
                                    records[0].site_name
                                );
                            }
                            if (records[0].tower_type) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'tower_type',
                                    records[0].tower_type
                                );
                            }
                            if (records[0].site_owner) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_owner',
                                    records[0].site_owner
                                );
                            }
                        }

                        // 	Case Import First
                        if (!d.product_scope) {
                            if (records[0].lat_long_actual) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'latlong',
                                    records[0].lat_long_actual
                                );
                            }

                            if (records[0].district_or_city_1) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'city_or_regency',
                                    records[0].district_or_city_1
                                );
                            }

                            if (records[0].province) {
                                frappe.model.set_value(d.doctype, d.name, 'province', records[0].province);
                            }

                            if (records[0].region) {
                                frappe.model.set_value(d.doctype, d.name, 'region', records[0].region);
                            }

                            if (records[0].area) {
                                frappe.model.set_value(d.doctype, d.name, 'area', records[0].area);
                            }

                            if (records[0].site_address) {
                                frappe.model.set_value(
                                    d.doctype,
                                    d.name,
                                    'site_address',
                                    records[0].site_address
                                );
                            }
                            if (records[0].district) {
                                frappe.model.set_value(d.doctype, d.name, 'district', records[0].district);
                            }
                        }
                    }
                })
                .catch((err) => console.error(err));
        }

        function checkTowerOwner(site_id) {
            console.log('checkTowerOwner');
            var site = frappe.db
                .get_list('Site', {
                    fields: ['name', 'tower_owner'],
                    filters: [['name', '=', site_id]],
                    limit: 100
                })
                .then((records) => {
                    if (records.length > 0) {
                        if (d.check_site_on == 'Mitratel' && records[0].tower_owner != 'MITRATEL') {
                            frappe.model.set_value(d.doctype, d.name, 'site_id_target', '');
                            frappe.throw(__('Tower Owner Must be MITRATEL'));
                        }

                        if (d.check_site_on != 'Mitratel' && records[0].tower_owner == 'MITRATEL') {
                            frappe.model.set_value(d.doctype, d.name, 'site_id_target', '');
                            frappe.throw(__("Tower Owner Can't be MITRATEL"));
                        }
                    }
                });
        }

        // check if site id, to prevent user input DROP/DISP
        function checkSiteStatusPromise(site_id_target) {
            return new Promise((resolve, reject) => {
                frappe.db
                    .get_list('Site', {
                        fields: ['name', 'workflow_state'],
                        filters: [['name', '=', site_id_target]],
                        limit: 100
                    })
                    .then((records) => {
                        console.log(records, 'checkSiteStatus');
                        if (records.length > 0) {
                            if (
                                records[0].workflow_state == 'DROP' ||
                                records[0].workflow_state == 'DISP'
                            ) {
                                console.log('data is DROP/DISP');
                                frappe.model.set_value(d.doctype, d.name, 'site_id_target', '');
                                frappe.hide_msgprint();
                                frappe.msgprint({
                                    title: 'Warning',
                                    message:
                                        'Site ID ' +
                                        '<b>' +
                                        site_id_target +
                                        '</b>' +
                                        ' already in status of ' +
                                        '<b>' +
                                        records[0].workflow_state +
                                        '</b>' +
                                        '. Please use another Site/Tower ID or contact the ticketing support.',
                                    indicator: 'red'
                                });
                            } else {
                                resolve(true);
                            }
                        } else {
                            console.log('data not found');

                            frappe.hide_msgprint();
                            frappe.msgprint({
                                title: 'Warning',
                                message:
                                    'Site ID ' +
                                    '<b>' +
                                    site_id_target +
                                    '</b>' +
                                    ' not found. Please use another Site ID or contact the ticketing support.',
                                indicator: 'red'
                            });
                        }
                    });
            });
        }

        function isHasDEVLorINOP(arr) {
            return arr.some(
                (item) => item.workflow_state === 'DEVL' || item.workflow_state === 'INOP'
            );
        }

        function checkSiteIdTarget(site_id_target, customer) {
            // check if site id reference is exist, not DROP or DISP
            frappe.db
                .get_list('Tenant', {
                    fields: ['workflow_state'],
                    filters: [
                        ['site_id', '=', site_id_target],
                        ['customer', '=', customer]
                    ],
                    limit: 100
                })
                .then((response) => {
                    console.log(response, 'checkSiteIdTarget');
                    // Check site_id_target workflow_state, if it is DEVL/INOP show alert
                    if (response.length > 0) {
                        if (isHasDEVLorINOP(response)) {
                            frappe.model.set_value(d.doctype, d.name, 'site_id_target', '');
                            frappe.hide_msgprint();
                            frappe.msgprint({
                                title: 'Warning',
                                message:
                                    'Tenant for ' +
                                    '<b>' +
                                    customer +
                                    '</b>' +
                                    ' at SITE ID ' +
                                    site_id_target +
                                    '<b>' +
                                    ' already exist.' +
                                    '</b>' +
                                    ' Please consider to change catalog into Additional Service or choose another tenant customer',
                                indicator: 'red'
                            });
                        }
                    }
                    else {
                        handleSiteDetail(d.site_id_target)
                    }
                });
        }
    },
    district: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        // frm.refresh_field("solution_list")

        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');

        if (d.district && d.district !== '') getDistrict();

        function getDistrict() {
            frappe.call({
                method: 'frappe.client.get',
                async: false,
                args: {
                    doctype: 'Location',
                    name: d.district
                },
                callback: function (response) {
                    // console.log(response);
                    if (response.message.district) {
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'city_or_regency',
                            response.message.parent_location
                        );
                    }
                }
            });
        }
    },
    city_or_regency: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        // frm.refresh_field("solution_list")

        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');

        if (d.city_or_regency && d.city_or_regency !== '') getCityOrRegency();

        function getCityOrRegency() {
            frappe.call({
                method: 'frappe.client.get',
                async: false,
                args: {
                    doctype: 'Location',
                    name: d.city_or_regency
                },
                callback: function (response) {
                    // console.log(response);
                    if (response.message.region) {
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'province',
                            response.message.parent_location
                        );
                    }
                }
            });
        }
    },
    province: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        // frm.refresh_field("solution_list")
        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');

        if (d.province && d.province !== '') getProvince();

        function getProvince() {
            frappe.call({
                method: 'frappe.client.get',
                async: false,
                args: {
                    doctype: 'Location',
                    name: d.city_or_regency
                },
                callback: function (response) {
                    if (response.message.region) {
                        frappe.model.set_value(d.doctype, d.name, 'region', response.message.region);
                    }
                }
            });
        }
    },
    region: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        // frm.refresh_field("sitelist_item")

        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');

        if (d.region && d.region !== '') getRegion();

        function getRegion() {
            frappe.call({
                method: 'frappe.client.get',
                async: false,
                args: {
                    doctype: 'Territory',
                    name: d.region
                },
                callback: function (response) {
                    if (response.message.parent_territory) {
                        frappe.model.set_value(
                            d.doctype,
                            d.name,
                            'area',
                            response.message.parent_territory
                        );
                    }
                }
            });
        }
    },
    area: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');
    },
    tower_height: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        console.log("test")
        setItemVariant('tower_height', d, frm);
        setItemVariant('height_request', d, frm);
        frm.refresh_field('kom_sitelist');
    },
    height_request: function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        console.log("test")

        if (d.new_tenant_info == 'Yes' && d.new_tower_info == 'Yes') {
            frappe.model.set_value(
                d.doctype,
                d.name,
                'tower_height',
                d.height_request
            );
        }

        setItemVariant('height_request', d, frm);


    },
    latlong: async function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        console.log(d);
        // Regular expression to check if string is a latitude and longitude
        const regexExp = /^((\-?|\+?)?\d+(\.\d+)?),\s*((\-?|\+?)?\d+(\.\d+)?)$/gi;


        if (d.latlong && d.latlong !== '') {
            console.log("d.input_order", d.input_order)
            console.log("d.change_site_loc", d.change_site_loc)
            if ((d.input_order == 'New Site' && d.change_site_loc == 'No') || (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site')) {
                if (!regexExp.test(d.latlong)) {
                    console.log('wrong lat long');
                    frappe.model.set_value(d.doctype, d.name, 'latlong', '');
                    frappe.throw(
                        __(
                            'Latitude and Longitude is not valid! Format: Lattitude, Longitude (in Signed Degree) e.g. -6.32216, 106.67569'
                        )
                    );
                }


                console.log('latlong check reverse geocode...');
                await frappe.call({
                    method: 'geocoding_api',
                    type: 'GET',
                    // async: true,
                    args: {
                        latlong: d.latlong
                    },
                    callback: async function (response) {
                        if (response.message) {
                            console.log(response)
                            console.log('checking response...');
                            if (!response.message.district || !response.message.city_regency) {
                                if (response.message.district_result && response.message.district_result.length > 0) {
                                    var suggestion = response.message.district_result[0];
                                    frappe.throw(`Row ${d.idx} with latlong ${d.latlong}: 
                                    The District, City, Province, Region, or Area could not be found using the Reverse Geocode service! 
                                    Please contact IT to create a new location for "${suggestion}".`);
                                } else if (response.status !== "ok" && response.message.address_options) {
                                    console.log('checking response other country...');
                                    var detectedCountry = response.message.address_options[response.message.address_options.length - 1];
                                    frappe.throw(`Row ${d.idx} with latlong ${d.latlong}: 
                                    The detected location appears to be in another country (${detectedCountry}). 
                                    Please verify the location.`);
                                }
                            }
                            console.log('response...', d, response.message);
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'district',
                                response.message.district
                            );
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'city_or_regency',
                                response.message.city_regency
                            );
                            frappe.model.set_value(
                                d.doctype,
                                d.name,
                                'site_address',
                                response.message.address
                            );

                            console.log('result...', d);

                            // 		frm.refresh_field('kom_sitelist');
                        } else {
                            frappe.throw(
                                __(
                                    'District, City, Province, Region, or Area cannot found by Reverse Geocode services! Please contact support.'
                                )
                            );
                        }
                    }
                });
            }
        } else {
            frappe.model.set_value(d.doctype, d.name, 'city_or_regency', '');
            frappe.model.set_value(d.doctype, d.name, 'site_address', '');
            frappe.model.set_value(d.doctype, d.name, 'area', '');
            frappe.model.set_value(d.doctype, d.name, 'province', '');
            frappe.model.set_value(d.doctype, d.name, 'region', '');
            frappe.model.set_value(d.doctype, d.name, 'district', '');
        }
    }
});

frappe.ui.form.on('KOM Child Table', {
    product_scope: async function (frm, cdt, cdn) {
        var d = locals[cdt][cdn];
        console.log('PS 2 line 3809');

        //Change to new concept using grid_rows_by_docname so only set to specific row not all by Hamid
        await frm.fields_dict['kom_sitelist'].grid.grid_rows_by_docname[d.name].docfields.forEach(
            async (df) => {
                // 		cur_frm.fields_dict['kom_sitelist'].grid.grid_rows.forEach((grid_row) => {
                // 			grid_row.docfields.forEach((df) => {
                // tower_height
                if (d.new_tower_info == 'Yes') {
                    if (['tower_height'].includes(df.fieldname)) {
                        df.read_only = 0;
                        df.reqd = 1;
                    }
                } else if (d.new_tower_info == 'No') {
                    if (['tower_height'].includes(df.fieldname)) {
                        df.read_only = 1;
                        df.reqd = 0;
                    }
                }

                // site_id_reference
                if (d.input_order == 'New Site') {
                    if (['site_id_reference'].includes(df.fieldname)) {
                        df.read_only = 1;
                        df.reqd = 0;
                    }
                } else if (d.input_order == 'Existing Site') {
                    if (['site_id_reference'].includes(df.fieldname)) {
                        df.read_only = 0;
                        df.reqd = 1;
                    }
                }

                // max_radius
                if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
                    if (['max_radius'].includes(df.fieldname)) {
                        df.read_only = 0;
                    }
                } else if (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site') {
                    if (['max_radius'].includes(df.fieldname)) {
                        df.read_only = 0;
                    }
                } else if (
                    (d.input_order == 'Existing Site' && d.change_site_loc == 'No') ||
                    d.change_site_loc == 'Target Existing Site'
                ) {
                    if (['max_radius'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                }

                // site_name
                // if (d.input_order == 'New Site') {
                // 	if (['site_name'].includes(df.fieldname)) {
                // 		df.read_only = 1;
                // 	}
                // } else if (d.input_order == 'Existing Site') {
                // 	if (['site_name'].includes(df.fieldname)) {
                // 		df.read_only = 1;
                // 	}
                // }

                // latlong
                if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
                    if (['latlong'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }

                    if (d.city_or_regency) {
                        frappe.model.set_value(d.doctype, d.name, 'city_or_regency', '');
                    }
                    if (d.site_address) {
                        frappe.model.set_value(d.doctype, d.name, 'site_address', '');
                    }
                    if (d.area) {
                        frappe.model.set_value(d.doctype, d.name, 'area', '');
                    }
                    if (d.province) {
                        frappe.model.set_value(d.doctype, d.name, 'province', '');
                    }
                    if (d.region) {
                        frappe.model.set_value(d.doctype, d.name, 'region', '');
                    }
                    if (d.district) {
                        frappe.model.set_value(d.doctype, d.name, 'district', '');
                    }
                } else if (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site') {
                    if (['latlong'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }

                    if (d.city_or_regency) {
                        frappe.model.set_value(d.doctype, d.name, 'city_or_regency', '');
                    }
                    if (d.site_address) {
                        frappe.model.set_value(d.doctype, d.name, 'site_address', '');
                    }
                    if (d.area) {
                        frappe.model.set_value(d.doctype, d.name, 'area', '');
                    }
                    if (d.province) {
                        frappe.model.set_value(d.doctype, d.name, 'province', '');
                    }
                    if (d.region) {
                        frappe.model.set_value(d.doctype, d.name, 'region', '');
                    }
                    if (d.district) {
                        frappe.model.set_value(d.doctype, d.name, 'district', '');
                    }
                } else if (
                    (d.input_order == 'Existing Site' && d.change_site_loc == 'No') ||
                    d.change_site_loc == 'Target Existing Site'
                ) {
                    if (['latlong'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                }

                // area, city_or_regency, province, region, site_address
                if (d.input_order == 'New Site' && d.change_site_loc == 'No') {
                    if (['area'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['city_or_regency'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['province'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['region'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['site_address'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['district'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                } else if (d.input_order == 'Existing Site' && d.change_site_loc == 'Target New Site') {
                    if (['area'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['city_or_regency'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['province'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['region'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['site_address'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['district'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                } else if (
                    d.input_order == 'Existing Site' &&
                    (d.change_site_loc == 'No' || d.change_site_loc == 'Target Existing Site')
                ) {
                    if (['area'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                    if (['city_or_regency'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                    if (['province'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                    if (['region'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                    if (['site_address'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                    if (['district'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                }

                // site_id_target
                if (d.change_site_loc == 'Yes' || d.change_site_loc == 'No') {
                    if (['site_id_target'].includes(df.fieldname)) {
                        df.read_only = 1;
                    }
                } else if (d.change_site_loc == 'Target Existing Site') {
                    if (['site_id_target'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                }

                // // site_id_tenant, site_name_tenant (non mandatory : relocation, additional, reseller)
                // if (d.new_tenant_info == 'Yes') {
                // 	if (['site_id_tenant'].includes(df.fieldname)) {
                // 		df.reqd = 1;
                // 	}
                // 	if (['site_name_tenant'].includes(df.fieldname)) {
                // 		df.reqd = 1;
                // 	}
                // } else if (d.new_tenant_info == 'No') {
                // 	if (['site_id_tenant'].includes(df.fieldname)) {
                // 		df.reqd = 0;
                // 	}
                // 	if (['site_name_tenant'].includes(df.fieldname)) {
                // 		df.reqd = 0;
                // 	}
                // }

                // site_id_tenant, site_name_tenant (all mandatory, except additional)
                if (d.tenant_options == 'Existing Tenant Modification') {
                    if (['site_id_tenant'].includes(df.fieldname)) {
                        df.reqd = 0;
                    }
                    if (['site_name_tenant'].includes(df.fieldname)) {
                        df.reqd = 0;
                    }
                } else {
                    if (['site_id_tenant'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                    if (['site_name_tenant'].includes(df.fieldname)) {
                        df.reqd = 1;
                    }
                }

                // tower_type
                if (
                    d.change_site_loc == 'No' ||
                    (d.change_site_loc == 'Target New Site' && d.new_tower_info == 'Yes')
                ) {
                    if (['tower_type'].includes(df.fieldname)) {
                        df.read_only = 0;
                        df.reqd = 0;
                    }
                } else if (d.change_site_loc == 'No' && d.new_tower_info == 'No') {
                    if (['tower_type'].includes(df.fieldname)) {
                        df.read_only = 1;
                        df.reqd = 0;
                    }
                } else if (d.change_site_loc == 'Target Existing Site' && d.new_tower_info == 'No') {
                    if (['tower_type'].includes(df.fieldname)) {
                        df.read_only = 1;
                        df.reqd = 0;
                    }
                }

                // tp_name (Tower Owner)
                if (
                    d.input_order == 'New Site' &&
                    d.change_site_loc == 'No' &&
                    d.check_site_on == 'Non Mitratel'
                ) {
                    if (['tp_name'].includes(df.fieldname)) {
                        df.read_only = 0;
                        df.reqd = 1;
                    }
                } else if (
                    d.input_order == 'New Site' &&
                    d.change_site_loc == 'No' &&
                    d.check_site_on == 'Mitratel'
                ) {
                    d.tp_name = 'MITRATEL';
                } else if (
                    d.input_order == 'Existing Site' &&
                    (d.change_site_loc == 'No' || d.change_site_loc == 'Target New Site') &&
                    (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
                ) {
                    if (['tp_name'].includes(df.fieldname)) {
                        df.read_only = 1;
                        df.reqd = 0;
                    }
                } else if (
                    d.input_order == 'Existing Site' &&
                    d.change_site_loc == 'Target Existing Site' &&
                    (d.check_site_on == 'Mitratel' || d.check_site_on == 'Non Mitratel')
                ) {
                    if (['tp_name'].includes(df.fieldname)) {
                        df.read_only = 1;
                        df.reqd = 0;
                    }
                }
                frm.fields_dict['kom_sitelist'].grid.grid_rows_by_docname[d.name].refresh();
            }
        );
        // 		});
    }
});

frappe.ui.form.on('KOM Child Table', {
    form_render: async function (frm, cdt, cdn) {
        let d = locals[cdt][cdn];
        if (d.product_scope) {
            frm.trigger('product_scope');
        }
        console.log('grid_row', cur_frm.fields_dict['kom_sitelist'].grid.grid_rows);
        console.log('form render d.site_id_tenant', d.site_id_tenant);

        //add new check to make sure every form render > case the value data is filled by set value or add child
        if (d.product_scope) {
            let grid_row = frm.fields_dict['kom_sitelist'].grid.grid_rows_by_docname[d.name];
            console.log('gridrow from form render', grid_row);
            validateSiteDF(grid_row);
        }

        // fetch from Application Form by Site ID Tenant and KOM ID
        if (d.site_id_tenant && frm.doc.update_to_ap == 1) {
            frappe.db
                .get_list('Application Form', {
                    fields: ['name', 'site_id_tenant'],
                    filters: [
                        ['kom_reference', '=', frm.doc.name],
                        ['site_id_tenant', '=', d.site_id_tenant]
                    ]
                })
                .then((records) => {
                    if (records.length == 0) {
                        frappe.hide_msgprint();
                        frappe.msgprint('Application Form not found for this Site ID Tenant');
                    } else if (records.length > 1) {
                        frappe.hide_msgprint();
                        frappe.msgprint('Multiple Application Form found for this Site ID Tenant');
                    } else {
                        var app = records[0];
                        (async () => {
                            // Get New Device Application Form Child
                            const records_nd = await frappe.db.get_list(
                                'New Device Application Form Child',
                                {
                                    fields: [
                                        'name',
                                        'device',
                                        'azimuth',
                                        'brand',
                                        'depth',
                                        'diameter',
                                        'height',
                                        'length',
                                        'model',
                                        'quantity',
                                        'sow',
                                        'tower_foot_side',
                                        'weight',
                                        'width'
                                    ],
                                    filters: [
                                        ['parent', '=', app.name],
                                        ['parentfield', '=', 'new_af_item']
                                    ],
                                    limit: 1000
                                }
                            );

                            let new_dd = await arrayGroup(records_nd, 'device');
                            console.log('new_dd', new_dd);
                            const new_device = [];
                            if (new_dd.length >= 1) {
                                new_dd.forEach((data) => {
                                    console.log('d', data);
                                    var data_device = [];
                                    data.forEach((d) => {
                                        if (d.quantity > 1) {
                                            console.log('d.quantity', d.quantity);
                                            for (let i = 0; i < d.quantity; i++) {
                                                data_device.push({
                                                    device: d.device,
                                                    azimuth: d.azimuth,
                                                    brand: d.brand,
                                                    depth: d.depth,
                                                    diameter: d.diameter,
                                                    height: d.height,
                                                    length: d.length,
                                                    model: d.model,
                                                    quantity: 1,
                                                    sow: d.sow,
                                                    tower_foot_side: d.tower_foot_side,
                                                    weight: d.weight,
                                                    width: d.width
                                                });
                                            }
                                        } else {
                                            data_device.push(d);
                                        }
                                    });
                                    new_device.push(data_device);
                                });
                            }

                            // Get Remove Device Application Form Child
                            const records_rd = await frappe.db.get_list(
                                'Remove Device Application Form Child',
                                {
                                    fields: [
                                        'name',
                                        'device',
                                        'azimuth',
                                        'brand',
                                        'depth',
                                        'diameter',
                                        'height',
                                        'length',
                                        'model',
                                        'quantity',
                                        'sow',
                                        'tower_foot_side',
                                        'weight',
                                        'width'
                                    ],
                                    filters: [['parent', '=', app.name]],
                                    limit: 1000
                                }
                            );

                            let rm_device = await arrayGroup(records_rd, 'device');
                            const remove_device = [];
                            if (rm_device.length >= 1) {
                                rm_device.forEach((data) => {
                                    console.log('d', data);
                                    var data_device = [];
                                    data.forEach((d) => {
                                        if (d.quantity > 1) {
                                            console.log('d.quantity', d.quantity);
                                            for (let i = 0; i < d.quantity; i++) {
                                                data_device.push({
                                                    device: d.device,
                                                    azimuth: d.azimuth,
                                                    brand: d.brand,
                                                    depth: d.depth,
                                                    diameter: d.diameter,
                                                    height: d.height,
                                                    length: d.length,
                                                    model: d.model,
                                                    quantity: 1,
                                                    sow: d.sow,
                                                    tower_foot_side: d.tower_foot_side,
                                                    weight: d.weight,
                                                    width: d.width
                                                });
                                            }
                                        } else {
                                            data_device.push(d);
                                        }
                                    });
                                    remove_device.push(data_device);
                                });
                            }
                            // Get Existing Device Application Form Child
                            const records_ed = await frappe.db.get_list('Installed Device', {
                                fields: ['name', 'device'],
                                filters: [['tenant_id', '=', d.tenant_id_reference]],
                                limit: 1000
                            });
                            let existing_device = await arrayGroup(records_ed, 'device');

                            let existingDeviceGroup = {};
                            existing_device.forEach((data) => {
                                let deviceId = data[0]['device'];
                                existingDeviceGroup[deviceId] = data;
                            });

                            let newDeviceGroup = {};
                            let totalNewDevice = 0;
                            new_device.forEach((data) => {
                                data.length > 0 ? (totalNewDevice += data.length) : '';
                                let deviceId = data[0]['device'];
                                newDeviceGroup[deviceId] = data;
                            });

                            let removeDeviceGroup = {};
                            let totalRemoveDevice = 0;
                            remove_device.forEach((data) => {
                                data.length > 0 ? (totalRemoveDevice += data.length) : '';
                                let deviceId = data[0]['device'];
                                removeDeviceGroup[deviceId] = data;
                            });

                            const table = document.querySelector(
                                `div[data-name='${d.name}'] #table_app_device`
                            );
                            let html = $(`<h4>Application Form Preview</h4>
										<table class="table table-bordered" style="cursor:pointer; margin:0px;">
										<caption></caption>
										<thead>
											<tr>
												
											</tr>
										</thead>
										<tbody></tbody>
									</table>`).appendTo(table);
                            html.find('thead tr').append('<th>Activity</th>');
                            html.find('thead tr').append('<th>Total</th>');

                            const device_type = await frappe.db.get_list('Device Master', {
                                fields: ['name'],
                                filters: [['device_group', '=', 'Antenna Device']]
                            });

                            const new_row = $(`<tr>`);
                            new_row.append(`<td>New Device</td>`);
                            new_row.append(`<td><b>${totalNewDevice}</b></td>`);

                            const remove_row = $(`<tr>`);
                            remove_row.append(`<td>Remove Device</td>`);
                            remove_row.append(`<td><b>${totalRemoveDevice}</b></td>`);

                            const existing_row = $(`<tr>`);
                            existing_row.append(`<td>OneFlux Existing Device</td>`);
                            existing_row.append(`<td><b>${existing_device.length}</b></td>`);

                            device_type.forEach((dev) => {
                                html.find('thead tr').append(`<th>${dev.name}</th>`);

                                let arrN = newDeviceGroup[dev.name] || [];
                                new_row.append(`<td>${arrN.length}</td>`);

                                let arrR = removeDeviceGroup[dev.name] || [];
                                remove_row.append(`<td>${arrR.length}</td>`);

                                let arrE = existingDeviceGroup[dev.name] || [];
                                existing_row.append(`<td>${arrE.length}</td>`);
                            });

                            html.find('tbody').append(new_row, remove_row, existing_row);
                        })();
                    }
                });
        }
        if (
            d.device_objec &&
            frm.doc.workflow_state == 'Waiting Update E-CAF' &&
            frm.doc.update_to_ap == 0
            // 			d.device_objec &&
            // 			(frm.doc.workflow_state == 'Draft' ||
            // 				frm.doc.workflow_state == 'AM Sales Review' ||
            // 				frm.doc.workflow_state == 'Waiting Update E-CAF') &&
            // 			(frm.doc.update_to_ap == 0 || frm.doc.update_to_ap == 1)
        ) {
            let device_objec = JSON.parse(d.device_objec);
            const new_dd = await arrayGroup(device_objec.new_af_item, 'device');
            const new_device = [];
            if (new_dd.length >= 1) {
                new_dd.forEach((data) => {
                    console.log('d', data);
                    var data_device = [];
                    data.forEach((d) => {
                        if (d.quantity > 1) {
                            console.log('d.quantity', d.quantity);
                            for (let i = 0; i < d.quantity; i++) {
                                data_device.push({
                                    device: d.device,
                                    azimuth: d.azimuth,
                                    brand: d.brand,
                                    depth: d.depth,
                                    diameter: d.diameter,
                                    height: d.height,
                                    length: d.length,
                                    model: d.model,
                                    quantity: 1,
                                    sow: d.sow,
                                    tower_foot_side: d.tower_foot_side,
                                    weight: d.weight,
                                    width: d.width
                                });
                            }
                        } else {
                            data_device.push(d);
                        }
                    });
                    new_device.push(data_device);
                });
            }
            const rm_device = await arrayGroup(device_objec.remove_af_item, 'device');
            const remove_device = [];
            if (rm_device.length >= 1) {
                rm_device.forEach((data) => {
                    console.log('d', data);
                    var data_device = [];
                    data.forEach((d) => {
                        if (d.quantity > 1) {
                            console.log('d.quantity', d.quantity);
                            for (let i = 0; i < d.quantity; i++) {
                                data_device.push({
                                    device: d.device,
                                    azimuth: d.azimuth,
                                    brand: d.brand,
                                    depth: d.depth,
                                    diameter: d.diameter,
                                    height: d.height,
                                    length: d.length,
                                    model: d.model,
                                    quantity: 1,
                                    sow: d.sow,
                                    tower_foot_side: d.tower_foot_side,
                                    weight: d.weight,
                                    width: d.width
                                });
                            }
                        } else {
                            data_device.push(d);
                        }
                    });
                    remove_device.push(data_device);
                });
            }
            const existing_device_object = await frappe.db.get_list('Installed Device', {
                fields: ['name', 'device'],
                filters: [['tenant_id', '=', d.tenant_id_reference]],
                limit: 1000
            });
            const existing_device = await arrayGroup(existing_device_object, 'device');
            // Get Existing Device Application Form Child
            let existingDeviceGroup = {};
            existing_device.forEach((data) => {
                let deviceId = data[0]['device'];
                existingDeviceGroup[deviceId] = data;
            });
            // Get New Device Application Form Child
            let newDeviceGroup = {};
            let totalNewDevice = 0;
            new_device.forEach((data) => {
                data.length > 0 ? (totalNewDevice += data.length) : null;
                let deviceId = data[0]['device'];
                newDeviceGroup[deviceId] = data;
            });
            // Get Remove Device Application Form Child
            let removeDeviceGroup = {};
            let totalRemoveDevice = 0;
            remove_device.forEach((data) => {
                data.length > 0 ? (totalRemoveDevice += data.length) : null;
                let deviceId = data[0]['device'];
                removeDeviceGroup[deviceId] = data;
            });
            const table = document.querySelector(`div[data-name='${d.name}'] #table_device_list`);
            let html = $(`<h4>Preview of Requested Device</h4>
				<table class="table table-bordered" style="cursor:pointer; margin:0px;">
				<caption></caption>
				<thead>
					<tr>
						
					</tr>
				</thead>
				<tbody></tbody>
				</table>`).appendTo(table);
            html.find('thead tr').append('<th>Activity</th>');
            html.find('thead tr').append('<th>Total</th>');
            const device_type = await frappe.db.get_list('Device Master', {
                fields: ['name'],
                filters: [['device_group', '=', 'Antenna Device']]
            });
            const new_row = $(`<tr>`);
            new_row.append(`<td>New Device</td>`);
            new_row.append(`<td><b>${totalNewDevice}</b></td>`);
            const remove_row = $(`<tr>`);
            remove_row.append(`<td>Remove Device</td>`);
            remove_row.append(`<td><b>${totalRemoveDevice}</b></td>`);
            const existing_row = $(`<tr>`);
            existing_row.append(`<td>OneFlux Existing Device</td>`);
            existing_row.append(`<td><b>${existing_device_object.length}</b></td>`);
            device_type.forEach((dev) => {
                html.find('thead tr').append(`<th>${dev.name}</th>`);
                let arrN = newDeviceGroup[dev.name] || [];
                new_row.append(`<td>${arrN.length}</td>`);

                let arrR = removeDeviceGroup[dev.name] || [];
                remove_row.append(`<td>${arrR.length}</td>`);

                let arrE = existingDeviceGroup[dev.name] || [];
                existing_row.append(`<td>${arrE.length}</td>`);
            });
            html.find('tbody').append(new_row, remove_row, existing_row);
        } else {
            console.log('No device object');
        }
    }
});

