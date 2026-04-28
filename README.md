# NIC-project-       ANUBHAV Feedback form 

## to run this project 
open mongodb and connect with database (police_feedback_system)
collection 1 - feedbacksubmissions
collection 2 - questions
collection 3 - 


1) open cmd as administrator and type these commands 
      net start mongodb
      sc query mongodb 
      cd (set path)
      npm run dev 

open  http://localhost:5000  ( to view feedback form in you browser )

open  [http://localhost:5000](http://localhost:5000/admin)  ( to view admin login in you browser )

2) open cmd as administrator and type this commands 
      cd (set path)
      python report_service.py
  it will use port 5001 
  follow these steps to enable report generating 
