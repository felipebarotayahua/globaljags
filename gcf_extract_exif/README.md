# GlobalJags extract_exif Google Cloud Function
This is a Google Cloud Function that will process images that were uploaded through the GlobalJags website. It will be developed in three parts.

1. Create a Node.js cloud function triggered by an upload to a Google Cloud Storage bucket
2. Read the contents of the EXIF GPS data
3. Convert the EXIF GPS data to a number and store location information for the photograph in Firestore

## Deploy the Cloud Function
Deploy the Cloud Function with the following command. Ensure you replace the `trigger-resource` with YOUR final bucket.

```
gcloud functions deploy extract_exif \
--runtime nodejs18 \
--trigger-event google.storage.object.finalize \
--entry-point extractExif \
--trigger-resource sp24-elliott-globaljags-final
```

## Trigger the Cloud Function
Trigger the Cloud Function by uploading a sample image to your bucket. **Ensure you replace YOUR BUCKET NAME in the command below.**

```
gsutil cp gs://sp23-globaljags-dev-sample-images/china/china1.jpeg gs://sp24-elliott-globaljags-final
```

