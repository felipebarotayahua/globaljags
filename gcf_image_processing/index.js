//Imports
const {Storage} = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const sharp = require('sharp');

const getExif = require('exif-async');
const parseDMS = require('parse-dms');

const {Firestore} = require('@google-cloud/firestore');

// Helper Functions
exports.generateThumbnail = async (file, context) => {
    const gcsFile = file;
    const storage = new Storage();
    const sourceBucket = storage.bucket(gcsFile.bucket);
    const thumbnailsBucket = storage.bucket('sp24-41200-fbarotay-gj-thumbnails');
    const finalBucket = storage.bucket('sp24-41200-fbarotay-gj-final');
  
    const version = process.env.K_REVISION;
    console.log(`Running Cloud Function version ${version}`);
  
    console.log(`File name: ${gcsFile.name}`);
    console.log(`Generation number: ${gcsFile.generation}`);
    console.log(`Content type: ${gcsFile.contentType}`);
  
    // Reject images that are not jpeg or png files
    let fileExtension = '';
    let validFile = false;
  
    if (gcsFile.contentType === 'image/jpeg') {
      console.log('This is a JPG file.');
      fileExtension = 'jpg';
      validFile = true;
    } else if (gcsFile.contentType === 'image/png') {
      console.log('This is a PNG file.');
      fileExtension = 'png';
      validFile = true;
    } else {
      console.log('This is not a valid file.');
    }
  
    // If the file is a valid photograph, download it to the 'local' VM so that we can create a thumbnail image
    if (validFile) {
      // Create path to 'local' version of image file
      const finalFinalName = `${gcsFile.generation}.${fileExtension}`;
      const workingDir = path.join(os.tmpdir(), 'thumbs');
      const tempFilePath = path.join(workingDir, finalFinalName);
      await fs.ensureDir(workingDir);

      await sourceBucket.file(gcsFile.name).download({
        destination: tempFilePath
      });
  
      await finalBucket.upload(tempFilePath);
  
      const thumbName = `thumb@64_${finalFinalName}`;
  
      // Create a path where we will store the thumbnail image locally
      // This will be something like `tmp/thumbs/thumb@64_1234567891234567.jpg`
      const thumbPath = path.join(workingDir, thumbName);
  
      // Generate thumbnail image and save it to the thumbPath, then upload the thumbnail to the thumbnailsBucket in cloud storage
      await sharp(tempFilePath).resize(64).withMetadata().toFile(thumbPath).then(async () => {
        await thumbnailsBucket.upload(thumbPath);
      });

      // Retrieve long, lat data from image
      let coordinates = await extractExif(tempFilePath);

      // Create image object with data to be added to database
      let imageObject = {};
      imageObject.lat = coordinates.lat;
      imageObject.lon = coordinates.lon;
      imageObject.imageName = finalFinalName;
      imageObject.thumbURL = `gs://sp24-41200-fbarotay-gj-thumbnails/${thumbName}`;
      imageObject.imageURL = `gs://sp24-41200-fbarotay-gj-final/${finalFinalName}`;

      // Write to Firestore
      writeToFS(imageObject);
  
      // Delete the temp working directory and its files from the GCF's VM
      await fs.remove(workingDir);
    }
  
    // DELETE the original file uploaded to the "Uploads" bucket
    await sourceBucket.file(gcsFile.name).delete();
    console.log(`Deleted uploaded file: ${gcsFile.name}`);
}

async function extractExif(file) {
    let gpsObject = await readExifData(file);
    console.log(gpsObject);
    let gpsDecimal = getGPSCoordinates(gpsObject);
    console.log(gpsDecimal);
    return gpsDecimal;
}

async function readExifData(localFile) {
    let exifData;
    try {
        exifData = await getExif(localFile);
        // console.log(exifData);
        return exifData.gps;
    } catch(err) {
        console.log(err);
        return null;
    }
}

function getGPSCoordinates(g) {
    // Parse DMS; string format - DEG:MINSECDIRECTION DEG:MIN:SECDIRECTION
    const latString = `${g.GPSLatitude[0]}:${g.GPSLatitude[1]}:${g.GPSLatitude[2]}${g.GPSLatitudeRef}`;
    const lonString = `${g.GPSLongitude[0]}:${g.GPSLongitude[1]}:${g.GPSLongitude[2]}${g.GPSLongitudeRef}`;

    const degCoords = parseDMS(`${latString} ${lonString}`);

    return degCoords;
}

async function writeToFS(obj) {
    const firestore = new Firestore({
        projectId: "sp24-41200-fbarotay-globaljags"
    });

    console.log('The imageObject: ');
    console.log(obj);

    // Write the object into Firestore
    let collectionRef = firestore.collection('photos');
    let documentRef = await collectionRef.add(obj);
    console.log(`Document created: ${documentRef.id}`);
}