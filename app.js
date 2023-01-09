import express, { json } from 'express';
import { MongoClient ,ObjectId} from 'mongodb';
import dotenv from "dotenv";
dotenv.config();

 var app=express();
 app.use(express.json());
 
const MONGO_URL=process.env.MONGO_URL;
// const PORT=process.env.PORT;

async function createConnection(){
    const client=new MongoClient(MONGO_URL);
    await client.connect();

    console.log("Mongo is Connected")
    return client;
}
export const client= await createConnection();

const PORT=5000;

app.listen(PORT,() => {
  console.log(`APP started ${PORT}`)});

//  app.use(express,json());

app.get("/", (req, res) => {
    res.send("Welcome to mentor assignment APP");
  });

  //1.Write API to create Student
app.post("/createStudent", async function(req, res){
  const {studentName}=req.body;
    const data= {
      "studentName":studentName,
      "mentor_ID": "",
      "mentor_name": "",
      "mentor_assigned":false
    };
    const result = await client.db("mentorAssignment").collection("students").insertOne(data)
    res.send(result);

  });

  //2.Write API to create Mentor
app.post("/createMentor", async function(req, res){ 
  const {mentorName}=req.body;
  const data= {
    "mentorName":mentorName,
    "student_ID": [],
    "student_assigned":false
  };
  const result = await client.db("mentorAssignment").collection("Mentors").insertOne(data)
  res.send(result);
});


//3. Write API to Assign a student to Mentor
// Select one mentor and Add multiple Student 
// A student who has a mentor should not be shown in List


app.put("/assignMentor", async function(req, res){ 
  const {mentorName,students}=req.body;
  //Get the mentor details
  const mentorFromDB=await client.db("mentorAssignment").collection("Mentors").findOne({"mentorName":mentorName});
  const studentlist=[];
  let initialMenteelength=0;
  // If mentor already have students, copy them to new student_ID array to be updated
  if(mentorFromDB.student_assigned===true){
    initialMenteelength=mentorFromDB.student_ID.length;
    mentorFromDB.student_ID.map((stud_id)=>studentlist.push(stud_id));
  }
  for(let i=0;i<students.length;i++){
    const studentName=students[i];
    //get details of student from DB
    const studentFromDB=await client.db("mentorAssignment").collection("students").findOne({"studentName":studentName});
   //check for each student if they already have mentor and if not update the mentor details to student
    if(studentFromDB.mentor_assigned===false){
      const result1=await client.db("mentorAssignment").collection("students").updateOne({"studentName":studentName},
      {$set:{"mentor_ID":mentorFromDB._id,"mentor_name":mentorFromDB.mentorName,"mentor_assigned":true}})
      studentlist.push(studentFromDB._id);
    }
  }
  //check if any new student added to the mentor and give response accordingly
  if((studentlist.length-initialMenteelength)>0){
    // update final stdent_ID array to mentor
  const result2=await client.db("mentorAssignment").collection("Mentors").updateOne({"mentorName":mentorName},
      {$set:{"student_ID":studentlist,"student_assigned":true}})
  res.send(` Students are added to mentor `);}
  else {
    res.send(`students already have mentor`)
  }
  });

  // 4. Write API to Assign or Change Mentor for particular Student
// Select One Student and Assign one Mentor

app.put("/changeMentor", async function(req, res){ 
  const {studentName,mentorName}=req.body;
  //get given student details from DB
  const mentorFromDB=await client.db("mentorAssignment").collection("Mentors").findOne({"mentorName":mentorName});
  //get given mentor details from DB
  const studentFromDB=await client.db("mentorAssignment").collection("students").findOne({"studentName":studentName});
 //check whether current mentor has assigned with the current  student given
  let sameMentorCheck=mentorFromDB.student_ID.filter(function(std_id)
  {
    if(String(std_id)===String(studentFromDB._id))
      return std_id;
    })
  if(sameMentorCheck.length>0){
    //respond that current mentor is having the same student as mentee
    res.send(`student already assigned to same  Mentor`);
  }else{
  //Removing student details from old mentor's data
  let flag=0;
    // check if student has old mentor other than current mentor
  if(studentFromDB.mentor_assigned===true) {
    let oldMentorStudentList=[];
    // get the array of student_ID of old mentor and remove current student
    const oldMentorFromDB = await client.db("mentorAssignment").collection("Mentors").findOne({"mentorName":studentFromDB.mentor_name});
        if(oldMentorFromDB.student_ID.length>1){
          oldMentorStudentList=oldMentorFromDB.student_ID;
          oldMentorStudentList=oldMentorStudentList.filter(function (std_ID){
            if(String(std_ID)!=String(studentFromDB._id))
              return std_ID;
          })
          //update the new student_ID array after removal to the old mentor
          const result2=await client.db("mentorAssignment").collection("Mentors").updateOne({"mentorName":oldMentorFromDB.mentorName},
          {$set:{"student_ID":oldMentorStudentList}})
        }else{
          //if the current student is the only mentee to the mentor then update empty array to student_ID and make student_assigned to false 
          const result2=await client.db("mentorAssignment").collection("Mentors").updateOne({"mentorName":oldMentorFromDB.mentorName},
          {$set:{"student_ID":[],"student_assigned":false}})
        }         
        flag=1;
 }
  const studentlist=[];
  if(mentorFromDB.student_assigned===true){
    //if the current mentor has other students then update the student_id  array with old and new student
    mentorFromDB.student_ID.map((stud_id)=>studentlist.push(stud_id));}
   studentlist.push(studentFromDB._id);
    // update the mentor database with new student_ID array
  const result=await client.db("mentorAssignment").collection("Mentors").updateOne({"mentorName":mentorName},
  {$set:{"student_ID":studentlist,"student_assigned":true}})

    // update the student database with new mentor details
  const result3=await client.db("mentorAssignment").collection("students").updateOne({"studentName":studentName},
  {$set:{"mentor_ID":mentorFromDB._id,"mentor_name":mentorFromDB.mentorName,"mentor_assigned":true}})

  //respond accordingly whether mentor is changed or newly assigned to the student
  if(flag===1){
      res.send(` Mentor changed for student`);
    }else{
        res.send(` Mentor assigned for student`);
        }
    }
  }
  );

 //5.Write API to show all students for a particular mentor

 app.get('/getAllStudentsOf/:mentorName',async function (request, response) {
  const {mentorName}=request.params;
  const mentorFromDB=await client.db("mentorAssignment").collection("Mentors").findOne({"mentorName":mentorName});
  const studentsList=mentorFromDB.student_ID;
  if(studentsList.length>0){
      let studentsName=[];
      for(let i=0;i<studentsList.length;i++) {
        const studentFromDB=await client.db("mentorAssignment").collection("students").findOne({"_id":ObjectId(studentsList[i])});
        studentsName.push(studentFromDB.studentName)
      }
      studentsName=studentsName.join(",");
      response.send(`students of ${mentorName} are ${studentsName}`);
  }else{
    response.send(` ${mentorName} has no students`);
  }
  });
