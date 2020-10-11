//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
  if (pt.name) {
    var names = pt.name.map(function(name) {
      return name.given.join(" ") + " " + name.family;
    });
    return names.join(" / ")
  } else {
    return "anonymous";
  }
}

// helper2: display the patient name gender and dob in the index page
function displayPatient(pt) {
  document.getElementById('patient_name').innerHTML = getPatientName(pt);
  document.getElementById('gender').innerHTML = pt.gender;
  document.getElementById('dob').innerHTML = pt.birthDate;
}

//helper3: function to display list of medications
//provide the data, pull different info to differernt patients
function displayMedication(meds) {
  med_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
  if (typeof ob != 'undefined' &&
    typeof ob.valueQuantity != 'undefined' &&
    typeof ob.valueQuantity.value != 'undefined' &&
    typeof ob.valueQuantity.unit != 'undefined') {
    return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
  } else {
    return undefined;
  }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
  var formattedBPObservations = [];
  BPObservations.forEach(function(observation) {
    var BP = observation.component.find(function(component) {
      return component.code.coding.find(function(coding) {
        return coding.code == typeOfPressure;
      });
    });
    if (BP) {
      observation.valueQuantity = BP.valueQuantity;
      formattedBPObservations.push(observation);
    }
  });

  return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
  return {
    height: {
      value: ''
    },
    weight: {
      value: ''
    },
    sys: {
      value: ''
    },
    dia: {
      value: ''
    },
    ldl: {
      value: ''
    },
    hdl: {
      value: ''
    },
    note: 'No Annotation',
  };
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
  note.innerHTML = annotation;
}

//function to display the observation values you will need to update this
function displayObservation(obs) {
  hdl.innerHTML = obs.hdl;
  ldl.innerHTML = obs.ldl;
  sys.innerHTML = obs.sys;
  dia.innerHTML = obs.dia;
  height.innerHTML = obs.height;
  weight.innerHTML = obs.weight;
}

//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

  // get patient object and then display its demographics info in the banner
  client.request(`Patient/${client.patient.id}`).then(
    function(patient) {
      displayPatient(patient);
      console.log(patient);//very helpful to print the info in console
    }
  );

  // get observation resoruce values
  // you will need to update the below to retrive the weight and height values
  var query = new URLSearchParams();

  query.set("patient", client.patient.id);
  query.set("_count", 100);
  query.set("_sort", "-date");
  query.set("code", [          //lonic code for retried the high and weight
    'http://loinc.org|8462-4', //Diastolic blood pressure
    'http://loinc.org|8480-6', //Systolic blood pressure
    'http://loinc.org|2085-9', //Cholesterol in HDL [Mass/volume] in Serum or Plasma
    'http://loinc.org|2089-1', //Cholesterol in LDL [Mass/volume] in Serum or Plasma
    'http://loinc.org|55284-4',//Blood pressure systolic and diastolic
    'http://loinc.org|3141-9',  //Body weight Measured
    'http://loinc.org|8302-2',
    'http://loinc.org|29463-7',
  ].join(","));

  client.request("Observation?" + query, {
    pageLimit: 0,
    flat: true
  }).then(
    function(ob) {

      // group all of the observation resoruces by type into their own
      var byCodes = client.byCodes(ob, 'code');
      var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
      var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
      var hdl = byCodes('2085-9');
      var ldl = byCodes('2089-1');
      var height = byCodes('8302-2');
      var weight = byCodes('29463-7');

      // create patient object
      var p = defaultPatient();

      // set patient value parameters to the data pulled from the observation resoruce
      if (typeof systolicbp != 'undefined') {
        p.sys = systolicbp;
      } else {
        p.sys = 'undefined'
      }

      if (typeof diastolicbp != 'undefined') {
        p.dia = diastolicbp;
      } else {
        p.dia = 'undefined'
      }

      p.hdl = getQuantityValueAndUnit(hdl[0]);
      p.ldl = getQuantityValueAndUnit(ldl[0]);
      p.weight = getQuantityValueAndUnit(weight[0]);
      p.height = getQuantityValueAndUnit(height[0]);

      displayObservation(p)

    });


  // dummy data for medrequests
//  var medResults = ["SAMPLE Lasix 40mg","SAMPLE Naproxen sodium 220 MG Oral Tablet","SAMPLE Amoxicillin 250 MG"]
//
//  // get medication request resources this will need to be updated
//  // the goal is to pull all the medication requests and display it in the app. It can be both active and stopped medications
//  medResults.forEach(function(med) {
//    displayMedication(med);
//  })
//client.request(`Observation/${client.observation.note}`).then(
    client.request("Observation?", + client.patient.id,{
        resolveReferences: [
        "note",
        "note.authorReference",
        "note.authorString",
        ]
    })

    .then(function(observation) {
        displayAnnotation(getObservationNote(observation));
    })

// helper function to process fhir resource to get the observation context.
    function getObservationNote(ob) {
      if (ob.note) {
        var contx = ob.note.authorString;
        return contx
      } else {
        return "no note";
      }
}
  //update function to take in text input from the app and add the note for the latest weight observation annotation
  //you should include text and the author can be set to anything of your choice. keep in mind that this data will
  // be posted to a public sandbox
    function addWeightAnnotation() {
      var moment = new Date();
      var moment2 = moment.toISOString();
      var an_input= document.getElementById("annotation").value;
      var annotation = "authorString" + ": " + "Xiandong Peng<br>"
                       + "time" + ": " + moment2 + "<br>" +
                        "text" + ": " + "Latest weight is " + an_input + " Kg";
      displayAnnotation(annotation);
}

    function getMedicationName(medCodings) {
      var coding = medCodings.find(function(c){
         return c.system == "http://www.nlm.nih.gov/research/umls/rxnorm";
      });
         return coding && coding.display || "Unnamed Medication(TM)";
    }

// Get MedicationRequests for the selected patient
  client.request("/MedicationRequest?patient=" + client.patient.id, {
    resolveReferences: [ "medicationReference" ],
    graph: true
    })

// Reject if no MedicationRequests are found
  .then(function(data) {
    if (!data.entry || !data.entry.length) {
    throw new Error("No medications found for the selected patient");
    }
    return data.entry;
    })

// Build an array of medication names
  .then(function (entries) {
      entries.map(function(item) {
      displayMedication(getMedicationName(
                                client.getPath(item, "resource.medicationCodeableConcept.coding") ||
                                 client.getPath(item, "resource.medicationReference.code.coding")
                                 ));
     });
   })

  //event listner when the add button is clicked to call the function that will add the note to the weight observation
  document.getElementById('add').addEventListener('click', addWeightAnnotation);


}).catch(console.error);
