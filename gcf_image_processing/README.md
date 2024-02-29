gcloud functions deploy generate_thumbnails
--runtime nodejs18
--trigger-event google.storage.object.finalize
--entry-point generateThumbnail
--trigger-resource sp24-41200-fbarotay-gj-uploads

