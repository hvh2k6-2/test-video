const express = require("express");
const path = require("path");

const ejs = require("ejs");
const admin = require("firebase-admin");
const multer = require("multer");
const slugify = require("slugify");
const serviceAccount = require("./config/blogging-365bf-firebase-adminsdk-wcv07-f5d4f0d289.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://blogging-365bf.appspot.com",
});
const app = express();

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.get("/", (req, res) => {
  res.render("index");
});
app.get("/create", (req, res) => {
  res.render("create");
});
const bucket = admin.storage().bucket();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
app.post("/create", upload.single("image"), async (req, res) => {
  const title = req.body.title;
  const slug = req.body.slug;
  const filename = req.file;
  const content = req.body.content;
  const publish = req.body.publish || "public";
  if (!filename) {
    return res.status(400).send("Please upload an image");
  }
  const image = filename;
  const ImageStorageRef = admin
    .storage()
    .bucket()
    .file(`image-post/${image.originalname}`);
  await ImageStorageRef.createWriteStream().end(image.buffer);
  const mainImageUrl = await ImageStorageRef.getSignedUrl({
    action: "read",
    expires: "01-01-2100",
  });

  await admin
    .firestore()
    .collection("posts")
    .add({
      title: title,
      slug: slugify(slug || title, { lower: true }),
      createdAt: admin.firestore.Timestamp.now(),
      thumbPost: mainImageUrl[0],
      content: content,
      publish: publish,
      author: "admin",
    })
    .then(() => {
      res.redirect("/");
    });
});

app.get("/list", async (req, res) => {
  const posts = await admin.firestore().collection("posts").get();
  const postsArray = [];

  posts.forEach((post) => {
    const data = post.data();
    postsArray.push({
      id: post.id,
      title: data.title,
      slug: data.slug,
      createdAt: data.createdAt.toDate().toLocaleDateString(),
    });
  });
  console.log("app.get ~ postsArray:", postsArray);
  res.render("list-post", { posts: postsArray });
});
app.get("/update/:id", async (req, res) => {
  const id = req.params.id;
  const postData = await renderData("posts", id);
  res.render("update", { postData: postData });
  async function renderData(collectionName, docId) {
    const cofRef = admin.firestore().collection(collectionName).doc(docId);
    const doc = await cofRef.get();
    if (!doc.exists) {
      console.log("No such document!");
    }
    return {
      id: doc.id,
      ...doc.data(),
    };
  }
});

app.post("/update/:id", upload.single("image"), async (req, res) => {
  const id = req.params.id;
  const title = req.body.title;
  const slug = req.body.slug;
  const filename = req.file;
  const content = req.body.content;
  const publish = req.body.publish || "public";
  if (!filename) {
    return res.status(400).send("Please upload an image");
  }
  const image = filename;
  const ImageStorageRef = admin
    .storage()
    .bucket()
    .file(`image-post/${image.originalname}`);
  await ImageStorageRef.createWriteStream().end(image.buffer);
  const mainImageUrl = await ImageStorageRef.getSignedUrl({
    action: "read",
    expires: "01-01-2100",
  });
  await admin
    .firestore()
    .collection("posts")
    .doc(id)
    .update({
      title: title,
      slug: slugify(slug || title, { lower: true }),
      createdAt: admin.firestore.Timestamp.now(),
      thumbPost: mainImageUrl[0],
      content: content,
      publish: publish,
    })
    .then(() => {
      res.redirect("/");
    });
});
app.get("/delete/:id", async (req, res) => {
  const id = req.params.id;
  const postData = await renderData("posts", id);
  res.render("delete", { postData: postData });

  async function renderData(collectionName, docId) {
    const cofRef = admin.firestore().collection(collectionName).doc(docId);
    const doc = await cofRef.get();
    if (!doc.exists) {
      console.log("No such document!");
    }
    return {
      id: doc.id,
      ...doc.data(),
    };
  }
});
app.post("/delete/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const docSnapshot = await admin
      .firestore()
      .collection("posts")
      .doc(id)
      .get();
    if (docSnapshot.exists) {
      const postData = docSnapshot.data();
      const thumbPost = postData.thumbPost;
      const regex = /post\/([^?]+)/;
      const match = regex.exec(thumbPost);
      const imageName = (match && match[1]) || "";

      // Xóa ảnh từ Firebase Storage
      const storageRef = admin
        .storage()
        .bucket()
        .file(`image-post/${imageName}`);
      await storageRef.delete();

      // Xóa tài liệu (document) từ Firestore
      await admin.firestore().collection("posts").doc(id).delete();

      res.redirect("/");
    } else {
      console.log("Post not found");
      res.status(404).send("Post not found");
    }
  } catch (error) {
    console.error("Error deleting post and image:", error);
    res.status(500).send("Error deleting post and image");
  }
});

const port = 7000;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
