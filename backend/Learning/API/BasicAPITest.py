from fastapi import FastAPI, HTTPException, status, Path
from typing import Optional
from pydantic import BaseModel

app = FastAPI()

users = { 1 :{"name": "Octavio",
            "website": "www.sense.com",
            "age": "19",
            "role": "backend dev"}           }

# Base Pydantic Model
    # outputs an error code if you try to make a user with the incorrect type for a section
class User(BaseModel):
    name:str 
    website:str 
    age:int
    role:str

    # Allows you to change certain parts and not forced to change everythign
class UpdateUser(BaseModel):
    name : Optional[str] = None
    website : Optional[str] = None
    age : Optional[int] = None
    role : Optional[str] = None

@app.get("/")
def home():
    return {"message": "Hellow wordl!"}

    # user end point
    #get users

    # check if user id is in our user database(it's a dict for now) 
    #if not then raise a error code or return the user
@app.get("/user/{user_id}")
def get_user (user_id:int = Path(..., des = "The ID You want",gt = 0, lt = 100)):
    if user_id not in users:
        raise HTTPException(status_code = 404, detail = "User Not Found!")
    return users[user_id]

    # Create a user

@app.post("/users/{user_id}", status_code = status.HTTP_201_CREATED)
def create_user(user_id:int, user:User):
    if user_id in users:
        raise HTTPException(status_code = 400, detail = "User already exists")
    users[user_id] = user.dict()
    return user    


    # Update a user

@app.put("/users/{user_id}")
def update_user(user_id:int, user:UpdateUser):
    if user_id not in users:
        raise HTTPException(status_code = 404, detail = "User Not Found!")
    current_user = user[user_id]

    if user.name is not None:
        current_user["name"] = user.name
    if user.website is not None:
        current_user["website"] = user.website
    if user.age is not None:
        current_user["age"] = user.age
    if user.role is not None:
        current_user["role"] = user.role
    return current_user

    # Delete a user

@app.delete("/users/{user_id}")
def delete_user(user_id:int):
    if user_id not in users:
        raise HTTPException(status_code = 404, detail = "User Not Found!")
    delete_user = users.pop(user_id)
    return{"message":"User has been deleted","deleted_user":deleted_user}

    # Search for a user

@app.get("/users/search/")
def search_by_name(name :Optional[str] = None):
    if not name:
        return{"message":"Name parameter is required"}
    for user in users.values():
        if user["name"] == name:
            return user
    raise HTTPException(status_code = 404, detail = "User Not Found!")
    